import { distanceKm, type Band, type City, type Venue } from "@greenroom/world";

/** One venue's answer to a tour request. */
export interface VenueOffer {
  venueId: string;
  venuePubkey: string;
  city: string;
  country: string;
  capacity: number;
  /** Capacity the venue is willing to put on sale for this band. */
  offeredCapacity: number;
  /** Revenue share the venue asks for, in bps. */
  askBps: number;
  /** Minimum ticket price in lamports. */
  minPriceLamports: number;
  /** Day indexes (0 = first day of the window) the venue is free. */
  availableDays: number[];
  lat: number;
  lng: number;
  genres: string[];
}

export interface PlannedShow {
  city: string;
  country: string;
  venueId: string;
  venuePubkey: string;
  /** Day index inside the tour window. */
  day: number;
  capacity: number;
  ticketPriceLamports: number;
  thresholdBps: number;
  bandBps: number;
  venueBps: number;
  score: number;
  distanceFromPrevKm: number;
}

export interface PlanInput {
  band: Band;
  offers: VenueOffer[];
  cities: City[];
  /** How many shows the band wants. */
  wantedShows: number;
  /** Length of the tour window in days. */
  windowDays: number;
  /** Optional preferred start city. */
  startCity?: string;
  thresholdBps?: number;
  /** Scale applied to capacities for demos (e.g. 0.05 so 400 becomes 20). */
  capacityScale?: number;
  /** Lower bound after scaling. */
  minCapacity?: number;
}

/** 0..1 score of one offer for this band. Higher is better. */
export function scoreOffer(band: Band, o: VenueOffer): number {
  const genreFit = o.genres.includes(band.genre) ? 1 : 0.55;
  const ratio = o.offeredCapacity / Math.max(1, band.draw);
  const capFit = Math.max(0, 1 - Math.abs(Math.log(ratio)) / 1.2); // 1.0 at ratio 1, 0 at ~3.3x or 0.3x
  const shareFit = Math.max(0, 1 - (o.askBps - 2500) / 2500); // 1.0 at 25%, 0 at 50%
  const priceFit = o.minPriceLamports <= band.targetPriceLamports ? 1 : band.targetPriceLamports / o.minPriceLamports;
  return 0.35 * genreFit + 0.3 * capFit + 0.2 * shareFit + 0.15 * priceFit;
}

function nearestNeighbourOrder(points: { lat: number; lng: number }[], startIndex: number): number[] {
  const n = points.length;
  const visited = new Array(n).fill(false);
  const order = [startIndex];
  visited[startIndex] = true;
  while (order.length < n) {
    const last = points[order[order.length - 1]];
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const d = distanceKm(last, points[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    order.push(best);
    visited[best] = true;
  }
  return order;
}

function routeLength(points: { lat: number; lng: number }[], order: number[]): number {
  let total = 0;
  for (let i = 1; i < order.length; i++) total += distanceKm(points[order[i - 1]], points[order[i]]);
  return total;
}

/** Classic 2-opt improvement on an open path. */
function twoOpt(points: { lat: number; lng: number }[], order: number[]): number[] {
  let best = order.slice();
  let improved = true;
  let bestLen = routeLength(points, best);
  while (improved) {
    improved = false;
    for (let i = 1; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = best.slice(0, i).concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
        const len = routeLength(points, candidate);
        if (len < bestLen - 1e-9) {
          best = candidate;
          bestLen = len;
          improved = true;
        }
      }
    }
  }
  return best;
}

/**
 * Deterministic tour planner:
 * 1. keep the best offer per city,
 * 2. take the top `wantedShows` cities by score,
 * 3. order them geographically (nearest neighbour + 2-opt) starting near the
 *    band's home or the requested start city,
 * 4. assign days left to right, one show per day, a rest day after every third
 *    show, respecting each venue's availability (shifting forward when needed).
 */
export function planTour(input: PlanInput): PlannedShow[] {
  const { band, offers } = input;
  const thresholdBps = input.thresholdBps ?? 5000;
  const scale = input.capacityScale ?? 1;
  const minCap = input.minCapacity ?? 10;

  const bestPerCity = new Map<string, { offer: VenueOffer; score: number }>();
  for (const o of offers) {
    const score = scoreOffer(band, o);
    const cur = bestPerCity.get(o.city);
    if (!cur || score > cur.score) bestPerCity.set(o.city, { offer: o, score });
  }
  const ranked = [...bestPerCity.values()].sort((a, b) => b.score - a.score).slice(0, input.wantedShows);
  if (ranked.length === 0) return [];

  const points = ranked.map((r) => ({ lat: r.offer.lat, lng: r.offer.lng }));
  const home = input.cities.find((c) => c.name === (input.startCity ?? band.homeCity));
  let startIndex = 0;
  if (home) {
    let bestD = Infinity;
    points.forEach((p, i) => {
      const d = distanceKm(home, p);
      if (d < bestD) {
        bestD = d;
        startIndex = i;
      }
    });
  }
  const order = twoOpt(points, nearestNeighbourOrder(points, startIndex));

  const plan: PlannedShow[] = [];
  let day = 0;
  let showsSinceRest = 0;
  let prev: { lat: number; lng: number } | null = null;
  for (const idx of order) {
    const { offer, score } = ranked[idx];
    if (showsSinceRest === 3) {
      day += 1; // rest day
      showsSinceRest = 0;
    }
    // first available day at or after `day`
    const avail = offer.availableDays.filter((d) => d >= day && d < input.windowDays).sort((a, b) => a - b);
    if (avail.length === 0) continue; // venue cannot fit; skip city
    day = avail[0];
    const capacity = Math.max(minCap, Math.round(offer.offeredCapacity * scale));
    const venueBps = offer.askBps;
    plan.push({
      city: offer.city,
      country: offer.country,
      venueId: offer.venueId,
      venuePubkey: offer.venuePubkey,
      day,
      capacity,
      ticketPriceLamports: Math.max(offer.minPriceLamports, band.targetPriceLamports),
      thresholdBps,
      bandBps: 10_000 - venueBps,
      venueBps,
      score: Math.round(score * 1000) / 1000,
      distanceFromPrevKm: prev ? Math.round(distanceKm(prev, offer)) : 0,
    });
    prev = offer;
    day += 1;
    showsSinceRest += 1;
  }
  return plan;
}

export function describePlan(plan: PlannedShow[]): string {
  const total = plan.reduce((s, p) => s + p.distanceFromPrevKm, 0);
  return (
    plan.map((p) => `day ${p.day}: ${p.city} (${p.venueId}, cap ${p.capacity}, venue ${p.venueBps / 100}%)`).join(" -> ") +
    ` | ${plan.length} shows, ${total} km`
  );
}

/** Which of a venue's days are free: deterministic pseudo-calendar from the venue id. */
export function venueAvailability(venue: Venue, windowDays: number, busyRatio = 0.35): number[] {
  let h = 2166136261;
  for (const ch of venue.id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const days: number[] = [];
  for (let d = 0; d < windowDays; d++) {
    h = Math.imul(h ^ (d + 1), 16777619) >>> 0;
    if ((h >>> 8) / 16777216 >= busyRatio) days.push(d);
  }
  return days;
}
