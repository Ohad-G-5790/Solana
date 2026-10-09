/**
 * How a venue answers a tour request, as a pure function so the venue agent,
 * the keeper and the dashboard's "Create your tour" page all agree.
 */
import type { Venue } from "@greenroom/world";
import { venueAvailability, type VenueOffer } from "./planner.ts";

export type OfferVenue = Pick<Venue, "id" | "name" | "city" | "country" | "capacity" | "lat" | "lng" | "genres">;

export interface OfferRequest {
  genre: string;
  /** People the band expects to bring. */
  draw: number;
  targetPriceLamports: number;
  trackRecord: { showsCompleted: number; ticketsSoldTotal: number };
}

export interface OfferDecision {
  offer: boolean;
  askBps: number;
  offeredCapacity: number;
  minPriceLamports: number;
  reasoning: string;
}

/** The venue agent's baseline: fit (draw vs room), programme, track record. */
export function venueOfferHeuristic(v: OfferVenue, req: OfferRequest): OfferDecision {
  const genreFit = v.genres.includes(req.genre as never);
  const ratio = req.draw / v.capacity;
  const history = req.trackRecord;
  const avgPerShow = history.showsCompleted > 0 ? history.ticketsSoldTotal / history.showsCompleted : 0;
  // fit: the band should fill between 25% and 250% of the room (a small band
  // still gets a room up to 4x its draw: the venue sells only part of it)
  const fits = ratio >= 0.25 && ratio <= 2.5;
  const unknownBand = history.showsCompleted === 0;
  const strongHistory = history.showsCompleted >= 3 && avgPerShow >= 0.5 * req.draw;
  const offer = fits && (genreFit || strongHistory || ratio >= 0.8);
  let askBps = 3000;
  if (unknownBand) askBps += 500;
  if (strongHistory) askBps -= 300;
  if (!genreFit) askBps += 200;
  askBps = Math.min(4000, Math.max(2500, askBps));
  const offeredCapacity = Math.min(v.capacity, Math.round(Math.max(v.capacity * 0.5, Math.min(v.capacity, req.draw * (strongHistory ? 1.3 : 1.0)))));
  const minPriceLamports = Math.round(req.targetPriceLamports * (genreFit ? 0.8 : 1.0));
  const reasoning = offer
    ? `${v.name}: ${req.genre} ${genreFit ? "fits our programme" : "is off our usual programme"}, draw ${req.draw} vs capacity ${v.capacity}${strongHistory ? ", strong track record" : unknownBand ? ", no history so we ask a higher share" : ""}.`
    : `${v.name}: declined, draw ${req.draw} ${ratio < 0.25 ? "too small for" : ratio > 2.5 ? "too big for" : "does not fit"} a ${v.capacity}-cap room${genreFit ? "" : " and the genre is off-programme"}.`;
  return { offer, askBps, offeredCapacity, minPriceLamports, reasoning };
}

/** A positive decision as the offer the band agent plans with. */
export function toVenueOffer(v: OfferVenue, venuePubkey: string, d: OfferDecision, windowDays: number): VenueOffer {
  return {
    venueId: v.id,
    venueName: v.name,
    venuePubkey,
    city: v.city,
    country: v.country,
    capacity: v.capacity,
    offeredCapacity: d.offeredCapacity,
    askBps: d.askBps,
    minPriceLamports: d.minPriceLamports,
    availableDays: venueAvailability(v, windowDays),
    lat: v.lat,
    lng: v.lng,
    genres: v.genres,
  };
}
