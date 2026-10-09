import { PublicKey, type Keypair } from "@solana/web3.js";
import type { Band, Venue } from "@greenroom/world";
import type { GreenroomClient } from "@greenroom/sdk";
import type { Brain } from "./brain.ts";
import type { BusMessage, MessageBus } from "./bus.ts";
import { venueOfferHeuristic } from "./offers.ts";
import { venueAvailability, type VenueOffer } from "./planner.ts";

export interface TourRequest {
  bandId: string;
  bandName: string;
  bandAuthority: string;
  genre: string;
  draw: number;
  countries: string[];
  wantedShows?: number;
  windowDays: number;
  targetPriceLamports: number;
  trackRecord: { showsCompleted: number; ticketsSoldTotal: number; grossSettledLamports: number };
}

export interface ShowProposedData {
  show: string;
  venuePubkey: string;
  venueId: string;
  venueName?: string;
  city: string;
  day: number;
  capacity: number;
  ticketPriceLamports: number;
  venueBps: number;
  bandBps: number;
  thresholdBps: number;
  bandAuthority: string;
  bandName: string;
  /** Demo-clock unix seconds when sales opened (deadline and date follow from it). */
  salesOpenAt?: number;
  /** The cancelled show this one replaces. */
  replaces?: string;
}

/**
 * A venue's agent: answers tour requests with an offer (or declines) and
 * accepts or rejects proposed shows by checking them against its own offer.
 */
export class VenueAgent {
  readonly id: string;
  private lastOffer = new Map<string, VenueOffer>(); // bandId -> offer
  private readonly unsubscribe: (() => void)[] = [];

  constructor(
    readonly venue: Venue,
    readonly keypair: Keypair,
    readonly venueProfile: PublicKey,
    private readonly client: GreenroomClient,
    private readonly bus: MessageBus,
    private readonly brain: Brain
  ) {
    this.id = `venue:${venue.id}`;
  }

  start(): void {
    this.unsubscribe.push(this.bus.on<TourRequest>("tour.request", (m) => void this.onTourRequest(m)));
    this.unsubscribe.push(
      this.bus.on<ShowProposedData>("show.proposed", (m) => {
        if (m.data?.venuePubkey === this.venueProfile.toBase58()) void this.onShowProposed(m);
      })
    );
  }

  stop(): void {
    for (const u of this.unsubscribe) u();
  }

  private async onTourRequest(m: BusMessage<TourRequest>): Promise<void> {
    const req = m.data!;
    if (!req.countries.includes(this.venue.country)) return;
    const v = this.venue;
    const history = req.trackRecord;

    const decision = await this.brain.decide<{ offer: boolean; askBps: number; offeredCapacity: number; minPriceLamports: number }>({
      agent: this.id,
      title: `offer for ${req.bandName}`,
      system: `You are the booking agent of ${v.name}, a ${v.capacity}-capacity live venue in ${v.city} (${v.country}) that mostly hosts ${v.genres.join(", ")}. You protect the venue's calendar and revenue: ask for a share between 2500 and 4000 bps, never offer more than the venue capacity, and decline bands that do not fit.`,
      prompt: `Tour request from "${req.bandName}" (${req.genre}), typical draw ${req.draw} people, target ticket ${req.targetPriceLamports} lamports. On-chain track record: ${history.showsCompleted} settled shows, ${history.ticketsSoldTotal} tickets sold in total.`,
      schema: { offer: "boolean", askBps: "integer 2500-4000", offeredCapacity: "integer", minPriceLamports: "integer", reasoning: "string" },
      heuristic: () => {
        const { reasoning, ...value } = venueOfferHeuristic(v, req);
        return { value, reasoning };
      },
      validate: (x) =>
        typeof x.offer !== "boolean" || ![x.askBps, x.offeredCapacity, x.minPriceLamports].every((n) => Number.isInteger(n) && n >= 0)
          ? "malformed numbers"
          : x.askBps < 2500 || x.askBps > 4000
            ? "askBps out of range"
            : x.offeredCapacity > v.capacity
              ? "capacity above venue"
              : x.offer && (x.offeredCapacity < 1 || x.minPriceLamports < 1)
                ? "an offer needs tickets and a price"
                : x.minPriceLamports > req.targetPriceLamports * 1.5
                  ? "minimum price far above the band's target"
                  : null,
    });

    if (!decision.value.offer) {
      this.bus.publish({ kind: "venue.decline", from: this.id, to: `band:${req.bandId}`, text: decision.reasoning, data: { bandId: req.bandId } });
      return;
    }
    const offer: VenueOffer = {
      venueId: v.id,
      venueName: v.name,
      venuePubkey: this.venueProfile.toBase58(),
      city: v.city,
      country: v.country,
      capacity: v.capacity,
      offeredCapacity: decision.value.offeredCapacity,
      askBps: decision.value.askBps,
      minPriceLamports: decision.value.minPriceLamports,
      availableDays: venueAvailability(v, req.windowDays),
      lat: v.lat,
      lng: v.lng,
      genres: v.genres,
    };
    this.lastOffer.set(req.bandId, offer);
    this.bus.publish<VenueOffer>({
      kind: "venue.offer",
      from: this.id,
      to: `band:${req.bandId}`,
      text: `${decision.reasoning} Offer: up to ${offer.offeredCapacity} tickets, ${offer.askBps / 100}% to the venue, ${offer.availableDays.length} free days.`,
      data: offer,
    });
  }

  private async onShowProposed(m: BusMessage<ShowProposedData>): Promise<void> {
    const p = m.data!;
    const bandId = m.from.replace(/^band:/, "");
    const offer = this.lastOffer.get(bandId);
    const show = new PublicKey(p.show);
    const bandAuthority = new PublicKey(p.bandAuthority);

    const problems: string[] = [];
    if (!offer) problems.push("no offer on file");
    else {
      if (p.venueBps < offer.askBps - 200) problems.push(`venue share ${p.venueBps} below ask ${offer.askBps}`);
      if (p.ticketPriceLamports < offer.minPriceLamports) problems.push("ticket price below minimum");
      if (p.capacity > Math.max(offer.offeredCapacity, 10)) problems.push("capacity above offer");
      if (!offer.availableDays.includes(p.day)) problems.push(`day ${p.day} not available`);
      // Calendars move between an offer and a proposal: another promoter may have
      // taken the day meanwhile. Deterministic per venue and day (~8% of days).
      if (dayGotBooked(this.venue.id, p.day)) problems.push(`day ${p.day} was booked by someone else since our offer`);
    }
    const decision = await this.brain.decide<{ accept: boolean }>({
      agent: this.id,
      title: `accept show ${p.show.slice(0, 6)}`,
      system: `You are the booking agent of ${this.venue.name}. Accept a proposed show only if it matches the offer you made.`,
      prompt: `Proposal: day ${p.day}, ${p.capacity} tickets at ${p.ticketPriceLamports} lamports, venue share ${p.venueBps} bps. Your offer: ${JSON.stringify(offer)}. Problems found by the checker: ${problems.join("; ") || "none"}.`,
      schema: { accept: "boolean", reasoning: "string" },
      heuristic: () => ({
        value: { accept: problems.length === 0 },
        reasoning: problems.length === 0 ? `Terms match our offer, ${this.venue.name} confirms day ${p.day}.` : `Rejected: ${problems.join("; ")}.`,
      }),
      validate: (x) => (x.accept && problems.length > 0 ? "cannot accept a proposal that breaks the offer" : null),
    });

    try {
      if (decision.value.accept) {
        const tx = await this.client.acceptShow(this.keypair, show);
        this.bus.publish({ kind: "show.accepted", from: this.id, to: m.from, text: decision.reasoning, data: { show: p.show, city: p.city, venueId: this.venue.id }, tx });
      } else {
        const tx = await this.client.rejectShow(this.keypair, show, bandAuthority);
        this.bus.publish({ kind: "show.rejected", from: this.id, to: m.from, text: decision.reasoning, data: { show: p.show, city: p.city, venueId: this.venue.id }, tx });
      }
    } catch (e) {
      this.bus.publish({ kind: "note", from: this.id, text: `transaction failed: ${(e as Error).message.slice(0, 160)}` });
    }
  }
}

/** Deterministic "someone else booked that day" event: ~8% of (venue, day) pairs. */
export function dayGotBooked(venueId: string, day: number): boolean {
  let h = 2166136261;
  for (const ch of `${venueId}#${day}#taken`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return (h >>> 8) / 16777216 < 0.08;
}
