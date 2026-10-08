/**
 * Replacement options for a cancelled show. Pure, so the dashboard can show
 * the same reasoning. Three kinds, cheapest first:
 *
 *   downsize     same venue, same night, fewer tickets: the threshold drops with it
 *   same-city    a smaller room in the same city that the band approved
 *   nearby-city  an approved venue in another city close to the route
 *
 * Options only come from venues that made an offer and the band approved, so
 * the venue's agent already agreed to the terms in principle.
 */
import { distanceKm, drive, roadKm, type LatLng } from "@greenroom/world/geo";
import type { AlternativeOption } from "./approvals.ts";
import { scoreOffer, type PlanBand, type VenueOffer } from "./planner.ts";

export interface CancelledShow {
  venueId: string;
  city: string;
  day: number;
  /** Tickets that were on sale. */
  capacity: number;
  ticketsSold: number;
  thresholdBps: number;
}

export interface RouteStopRef {
  venueId: string;
  city: string;
  day: number;
  lat: number;
  lng: number;
}

export interface AlternativeInput {
  band: PlanBand;
  cancelled: CancelledShow;
  /** Offers the band approved (the cancelled venue's offer among them). */
  offers: VenueOffer[];
  /** Shows still on the tour (not cancelled), in any order. */
  route: RouteStopRef[];
  windowDays: number;
  capacityScale: number;
  minCapacity: number;
  /** Max extra road km a nearby-city replacement may add. */
  maxDetourKm?: number;
  /** Max options returned. */
  limit?: number;
}

const requiredFor = (capacity: number, thresholdBps: number) => Math.ceil((capacity * thresholdBps) / 10_000);
const label = (o: VenueOffer) => o.venueName ?? o.venueId.replace(/-/g, " ");

export function findAlternatives(input: AlternativeInput): AlternativeOption[] {
  const { band, cancelled, offers, route } = input;
  const maxDetour = input.maxDetourKm ?? 250;
  const thr = cancelled.thresholdBps;
  const original = offers.find((o) => o.venueId === cancelled.venueId);
  const sorted = [...route].sort((a, b) => a.day - b.day);
  const prev = [...sorted].reverse().find((s) => s.day < cancelled.day);
  const next = sorted.find((s) => s.day > cancelled.day);
  const usedDays = new Set(route.map((s) => s.day));
  const onRoute = new Set(route.map((s) => s.venueId));
  const here: LatLng | undefined = original ?? undefined;

  const legKm = (a: LatLng | undefined, b: LatLng | undefined) => (a && b ? roadKm(a, b) : 0);
  const baseKm = legKm(prev, here) + legKm(here, next);
  const detour = (o: LatLng) => Math.round(legKm(prev, o) + legKm(o, next) - baseKm);
  const driveIn = (o: LatLng) => (prev ? drive(prev, o) : { km: 0, minutes: 0 });
  const terms = (o: VenueOffer) => {
    const venueBps = o.askBps;
    return { ticketPriceLamports: Math.max(o.minPriceLamports, band.targetPriceLamports), venueBps, bandBps: 10_000 - venueBps, thresholdBps: thr };
  };
  /** First free day for this venue near the cancelled date that keeps the route in order. */
  const dayFor = (o: VenueOffer): number | null => {
    for (const d of [cancelled.day, cancelled.day + 1, cancelled.day - 1]) {
      if (d < 0 || d >= input.windowDays || usedDays.has(d)) continue;
      if ((prev && d <= prev.day) || (next && d >= next.day)) continue;
      if (o.availableDays.includes(d)) return d;
    }
    return null;
  };

  const options: (AlternativeOption & { rank: number })[] = [];

  // 1. Same venue, same night, half the tickets.
  if (original) {
    const capacity = Math.max(input.minCapacity, Math.round(cancelled.capacity / 2));
    if (capacity < cancelled.capacity) {
      const required = requiredFor(capacity, thr);
      const d = driveIn(original);
      options.push({
        id: `downsize:${original.venueId}:${cancelled.day}`,
        kind: "downsize",
        venueId: original.venueId,
        venueName: label(original),
        venuePubkey: original.venuePubkey,
        city: original.city,
        country: original.country,
        lat: original.lat,
        lng: original.lng,
        day: cancelled.day,
        capacity,
        required,
        ...terms(original),
        detourKm: 0,
        driveInKm: d.km,
        driveInMinutes: d.minutes,
        reason: `Same night at ${label(original)} with ${capacity} tickets instead of ${cancelled.capacity}: it confirms at ${required} sold (you had ${cancelled.ticketsSold}). The route does not change.`,
        rank: 4,
      });
    }
  }

  // 2 and 3. Other approved venues, smaller rooms in the same city or close by.
  for (const o of offers) {
    if (o.venueId === cancelled.venueId || onRoute.has(o.venueId)) continue;
    const sameCity = o.city === cancelled.city;
    const extra = detour(o);
    if (!sameCity && (extra > maxDetour || (here && distanceKm(here, o) > maxDetour))) continue;
    if (route.some((s) => s.city === o.city)) continue; // already playing that city
    const day = dayFor(o);
    if (day === null) continue;
    const capacity = Math.max(input.minCapacity, Math.min(cancelled.capacity, Math.round(o.offeredCapacity * input.capacityScale)));
    if (sameCity && capacity >= cancelled.capacity) continue; // the same city needs a smaller room
    const required = requiredFor(capacity, thr);
    const d = driveIn(o);
    const fit = scoreOffer(band, o);
    const when = day === cancelled.day ? "same night" : day > cancelled.day ? "one day later" : "one day earlier";
    options.push({
      id: `${sameCity ? "same-city" : "nearby-city"}:${o.venueId}:${day}`,
      kind: sameCity ? "same-city" : "nearby-city",
      venueId: o.venueId,
      venueName: label(o),
      venuePubkey: o.venuePubkey,
      city: o.city,
      country: o.country,
      lat: o.lat,
      lng: o.lng,
      day,
      capacity,
      required,
      ...terms(o),
      detourKm: Math.max(0, extra),
      driveInKm: d.km,
      driveInMinutes: d.minutes,
      reason: sameCity
        ? `Smaller room in ${o.city}, ${when}: ${capacity} tickets, confirms at ${required}. ${label(o)} asks ${o.askBps / 100}%.`
        : `${o.city} instead of ${cancelled.city}, ${when}: ${capacity} tickets, confirms at ${required}; ${extra <= 0 ? "no extra driving" : `+${extra} km of driving`}. ${label(o)} asks ${o.askBps / 100}%.`,
      rank: (sameCity ? 2 : 1) + fit - Math.max(0, extra) / 500,
    });
  }

  return options
    .sort((a, b) => b.rank - a.rank)
    .slice(0, input.limit ?? 3)
    .map(({ rank: _rank, ...o }) => o);
}
