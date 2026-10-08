/**
 * Band approvals: the points where the band's agent stops and asks the band.
 *
 *   1. venues       which of the venues that made an offer the band is willing to play
 *   2. route        the itinerary planned from the approved venues (nothing is on-chain yet)
 *   3. alternative  after a show is cancelled: book a replacement, or not
 *
 * This module is pure (types, request builders, answer validation, transcript
 * reading) so the dashboard can import it in the browser. The waiting side
 * (auto-pilot or decisions written by the dashboard) lives in approver.ts.
 */
import { drive, driveLevel, legs, routeTotals, type LatLng } from "@greenroom/world/geo";
import { scoreOffer, type PlanBand, type PlannedShow, type VenueOffer } from "./planner.ts";

export type ApprovalMode = "auto" | "dashboard";
export type ApprovalStep = "venues" | "route" | "alternative";

/** One venue's offer as the band sees it (the full offer, so a dashboard can preview the route). */
export interface VenueChoice extends VenueOffer {
  venueName: string;
  freeDays: number;
  /** 0..1 fit for this band (genre, room size vs draw, share, price). */
  score: number;
  recommended: boolean;
  /** Estimated drive from the band's home city. */
  fromHomeKm: number;
  fromHomeMinutes: number;
  note: string;
}

export interface RouteStop {
  day: number;
  city: string;
  country: string;
  venueId: string;
  venueName: string;
  lat: number;
  lng: number;
  /** Tickets on sale (demo-scaled). */
  capacity: number;
  ticketPriceLamports: number;
  venueBps: number;
  thresholdBps: number;
  /** Drive in from the previous stop (0 for the first). */
  driveKm: number;
  driveMinutes: number;
  /** Days without a show between the previous stop and this one. */
  daysOffBefore: number;
}

export interface RouteSummary {
  shows: number;
  days: number;
  km: number;
  driveMinutes: number;
  longestLegKm: number;
  longestLegMinutes: number;
  longLegs: number;
  travelDayLegs: number;
  daysOff: number;
  /** Gross ticket revenue if every show just reaches its threshold / sells out. */
  grossAtThresholdLamports: number;
  grossAtSelloutLamports: number;
  /** The band's share at sellout, before crew. */
  bandAtSelloutLamports: number;
}

export type AlternativeKind = "downsize" | "same-city" | "nearby-city";

export interface AlternativeOption {
  id: string;
  kind: AlternativeKind;
  venueId: string;
  venueName: string;
  venuePubkey: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  day: number;
  capacity: number;
  /** Tickets needed to confirm (threshold x capacity). */
  required: number;
  ticketPriceLamports: number;
  venueBps: number;
  bandBps: number;
  thresholdBps: number;
  /** Extra road km this adds to the tour compared with the cancelled stop. */
  detourKm: number;
  /** Drive in from the previous stop on the route (0 if it is the first). */
  driveInKm: number;
  driveInMinutes: number;
  reason: string;
}

/** What the planner needs to redo the agent's draft route (the dashboard previews it). */
export interface PlanningInput {
  band: PlanBand;
  windowDays: number;
  thresholdBps: number;
  capacityScale: number;
  minCapacity: number;
}

export type ApprovalPayload =
  | { step: "venues"; homeCity: string; wantedShows: number; offers: VenueChoice[]; planning?: PlanningInput }
  | { step: "route"; round: number; stops: RouteStop[]; summary: RouteSummary }
  | {
      step: "alternative";
      show: string;
      city: string;
      venueId: string;
      venueName: string;
      day: number;
      capacity: number;
      ticketsSold: number;
      required: number;
      options: AlternativeOption[];
    };

export type ApprovalAnswer =
  | { step: "venues"; approve: boolean; venueIds: string[] }
  | { step: "route"; approve: boolean; dropVenueIds: string[] }
  | { step: "alternative"; approve: boolean; optionId: string | null };

export interface ApprovalRequest {
  id: string;
  mode: ApprovalMode;
  title: string;
  payload: ApprovalPayload;
  /** What the agent recommends; auto-pilot answers with exactly this. */
  recommended: ApprovalAnswer;
  /** ms epoch; an unanswered request is declined after this. */
  expiresAt?: number;
}

export type DecidedBy = "you" | "auto-pilot" | "expired";

export interface ApprovalDecision {
  id: string;
  answer: ApprovalAnswer;
  by: DecidedBy;
}

// ---------- builders ----------

const venueLabel = (o: VenueOffer) => o.venueName ?? o.venueId.replace(/-/g, " ");

function venueNote(band: PlanBand, o: VenueOffer, inPlan: boolean, backup: boolean): string {
  const ratio = o.offeredCapacity / Math.max(1, band.draw);
  const parts: string[] = [];
  parts.push(o.genres.includes(band.genre) ? `${band.genre} fits their programme` : `${band.genre} is off their usual programme`);
  if (ratio > 2) parts.push(`room is ${ratio.toFixed(1)}x your draw`);
  else if (ratio < 0.6) parts.push(`room holds only ${Math.round(ratio * 100)}% of your draw`);
  else parts.push(`room size fits your draw of ${band.draw}`);
  parts.push(`asks ${o.askBps / 100}%`);
  const lead = inPlan ? "On the planned route" : backup ? "Backup" : "Not recommended";
  return `${lead}: ${parts.join(", ")}.`;
}

/**
 * The venues step: every offer, scored, with the planner's picks and a few
 * backups recommended (backups are what replacement shows are drawn from).
 */
export function buildVenueChoices(band: PlanBand, offers: VenueOffer[], plan: PlannedShow[], home: LatLng | undefined, wantedShows: number): VenueChoice[] {
  const inPlan = new Set(plan.map((p) => p.venueId));
  const scored = offers.map((o) => ({ o, score: scoreOffer(band, o) })).sort((a, b) => b.score - a.score);
  const backups = new Set(
    scored
      .filter((x) => !inPlan.has(x.o.venueId) && x.score >= 0.5)
      .slice(0, Math.max(3, Math.ceil(wantedShows / 2)))
      .map((x) => x.o.venueId)
  );
  return scored.map(({ o, score }) => {
    const d = home ? drive(home, o) : { km: 0, minutes: 0 };
    const recommended = inPlan.has(o.venueId) || backups.has(o.venueId);
    return {
      ...o,
      venueName: venueLabel(o),
      freeDays: o.availableDays.length,
      score: Math.round(score * 100) / 100,
      recommended,
      fromHomeKm: d.km,
      fromHomeMinutes: d.minutes,
      note: venueNote(band, o, inPlan.has(o.venueId), backups.has(o.venueId)),
    };
  });
}

/** The route step: stops with drive legs and days off, plus totals and money. */
export function buildRoute(plan: PlannedShow[], offers: VenueOffer[]): { stops: RouteStop[]; summary: RouteSummary } {
  const where = new Map(offers.map((o) => [o.venueId, o]));
  const points = plan.map((p) => where.get(p.venueId) ?? { lat: 0, lng: 0 });
  const l = legs(points);
  const stops: RouteStop[] = plan.map((p, i) => ({
    day: p.day,
    city: p.city,
    country: p.country,
    venueId: p.venueId,
    venueName: p.venueName ?? (where.get(p.venueId) ? venueLabel(where.get(p.venueId)!) : p.venueId),
    lat: points[i].lat,
    lng: points[i].lng,
    capacity: p.capacity,
    ticketPriceLamports: p.ticketPriceLamports,
    venueBps: p.venueBps,
    thresholdBps: p.thresholdBps,
    driveKm: i === 0 ? 0 : l[i - 1].km,
    driveMinutes: i === 0 ? 0 : l[i - 1].minutes,
    daysOffBefore: i === 0 ? 0 : Math.max(0, p.day - plan[i - 1].day - 1),
  }));
  return { stops, summary: summarizeRoute(stops) };
}

export function summarizeRoute(stops: RouteStop[]): RouteSummary {
  const t = routeTotals(stops.slice(1).map((s) => ({ km: s.driveKm, minutes: s.driveMinutes, level: driveLevel(s.driveMinutes) })));
  let grossThr = 0;
  let grossAll = 0;
  let band = 0;
  for (const s of stops) {
    grossThr += Math.ceil((s.capacity * s.thresholdBps) / 10_000) * s.ticketPriceLamports;
    grossAll += s.capacity * s.ticketPriceLamports;
    band += Math.floor((s.capacity * s.ticketPriceLamports * (10_000 - s.venueBps)) / 10_000);
  }
  const days = stops.length ? stops[stops.length - 1].day - stops[0].day + 1 : 0;
  return {
    shows: stops.length,
    days,
    km: t.km,
    driveMinutes: t.minutes,
    longestLegKm: t.longest?.km ?? 0,
    longestLegMinutes: t.longest?.minutes ?? 0,
    longLegs: t.longLegs,
    travelDayLegs: t.travelDayLegs,
    daysOff: Math.max(0, days - stops.length),
    grossAtThresholdLamports: grossThr,
    grossAtSelloutLamports: grossAll,
    bandAtSelloutLamports: band,
  };
}

// ---------- answers ----------

/** The "no" answer for a request (used when it expires). */
export function declineAnswer(req: ApprovalRequest): ApprovalAnswer {
  const step = req.payload.step;
  if (step === "venues") return { step, approve: false, venueIds: [] };
  if (step === "route") return { step, approve: false, dropVenueIds: [] };
  return { step, approve: false, optionId: null };
}

const isStringArray = (x: unknown): x is string[] => Array.isArray(x) && x.every((v) => typeof v === "string");

/**
 * Validate an answer that came from outside (the dashboard). Returns a clean
 * answer, or a reason it cannot be used.
 */
export function checkAnswer(req: ApprovalRequest, raw: unknown): { answer: ApprovalAnswer } | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "answer must be an object" };
  const a = raw as Record<string, unknown>;
  const p = req.payload;
  if (a.step !== p.step) return { error: `answer is for step "${String(a.step)}", request is "${p.step}"` };
  if (typeof a.approve !== "boolean") return { error: "approve must be true or false" };
  if (p.step === "venues") {
    if (!isStringArray(a.venueIds)) return { error: "venueIds must be a list" };
    const known = new Set(p.offers.map((o) => o.venueId));
    const unknown = a.venueIds.filter((v) => !known.has(v));
    if (unknown.length) return { error: `unknown venues: ${unknown.join(", ")}` };
    if (a.approve && a.venueIds.length === 0) return { error: "approve at least one venue, or decline" };
    return { answer: { step: "venues", approve: a.approve, venueIds: a.approve ? [...new Set(a.venueIds)] : [] } };
  }
  if (p.step === "route") {
    const drop = a.dropVenueIds ?? [];
    if (!isStringArray(drop)) return { error: "dropVenueIds must be a list" };
    const known = new Set(p.stops.map((s) => s.venueId));
    const unknown = drop.filter((v) => !known.has(v));
    if (unknown.length) return { error: `not on this route: ${unknown.join(", ")}` };
    if (a.approve && drop.length) return { error: "approve the route as is, or ask for a re-plan without some stops" };
    if (drop.length >= p.stops.length) return { error: "a re-plan needs at least one stop left" };
    return { answer: { step: "route", approve: a.approve, dropVenueIds: [...new Set(drop)] } };
  }
  const optionId = a.optionId ?? null;
  if (a.approve) {
    if (typeof optionId !== "string" || !p.options.some((o) => o.id === optionId)) return { error: "pick one of the offered options" };
    return { answer: { step: "alternative", approve: true, optionId } };
  }
  return { answer: { step: "alternative", approve: false, optionId: null } };
}

/** One line for the feed. */
export function describeDecision(req: ApprovalRequest, d: ApprovalDecision): string {
  const who = d.by === "you" ? "You" : d.by === "auto-pilot" ? "Auto-pilot" : "Nobody answered in time;";
  const a = d.answer;
  const p = req.payload;
  if (a.step === "venues" && p.step === "venues") {
    if (!a.approve) return `${who} declined every venue. Nothing will be booked.`;
    const cities = new Set(p.offers.filter((o) => a.venueIds.includes(o.venueId)).map((o) => o.city));
    return `${who} approved ${a.venueIds.length} of ${p.offers.length} venues in ${cities.size} cities.`;
  }
  if (a.step === "route" && p.step === "route") {
    if (a.approve) return `${who} approved the route: ${p.stops.map((s) => s.city).join(" → ")}. Booking it on-chain now.`;
    if (a.dropVenueIds.length) {
      const names = p.stops.filter((s) => a.dropVenueIds.includes(s.venueId)).map((s) => s.city);
      return `${who} asked for a new route without ${names.join(", ")}.`;
    }
    return `${who} declined the route. Nothing will be booked.`;
  }
  if (a.step === "alternative" && p.step === "alternative") {
    const o = p.options.find((x) => x.id === a.optionId);
    if (a.approve && o) return `${who} picked a replacement for ${p.city}: ${o.venueName}, ${o.city}, ${o.capacity} tickets.`;
    return d.by === "expired" ? `${who} no replacement for ${p.city}.` : `${who} chose no replacement for ${p.city}.`;
  }
  return `${who} answered.`;
}

// ---------- reading a transcript ----------

export interface ApprovalItem {
  request: ApprovalRequest;
  requestedAt: number;
  decision?: ApprovalDecision;
  decidedAt?: number;
}

/** Approval requests and their decisions, in the order they were asked. */
export function deriveApprovals(messages: { kind: string; at: number; data?: unknown }[]): ApprovalItem[] {
  const items: ApprovalItem[] = [];
  const byId = new Map<string, ApprovalItem>();
  for (const m of messages) {
    if (m.kind === "approval.request" && m.data) {
      const request = m.data as ApprovalRequest;
      const item: ApprovalItem = { request, requestedAt: m.at };
      items.push(item);
      byId.set(request.id, item);
    } else if (m.kind === "approval.decision" && m.data) {
      const decision = m.data as ApprovalDecision;
      const item = byId.get(decision.id);
      if (item && !item.decision) {
        item.decision = decision;
        item.decidedAt = m.at;
      }
    }
  }
  return items;
}
