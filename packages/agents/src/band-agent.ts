import { PublicKey, type Keypair } from "@solana/web3.js";
import type { Band, City, CrewProfile } from "@greenroom/world";
import { bandPda, type GreenroomClient } from "@greenroom/sdk";
import type { Brain } from "./brain.ts";
import type { MessageBus } from "./bus.ts";
import { describePlan, planTour, type PlannedShow, type VenueOffer } from "./planner.ts";
import type { ShowProposedData, TourRequest } from "./venue-agent.ts";

export interface TourBrief {
  countries: string[];
  wantedShows: number;
  windowDays: number;
  startCity?: string;
  thresholdBps: number;
  /** Seconds between "sales open" and the threshold deadline (demo clock). */
  deadlineAfterSec: number;
  /** Seconds between "sales open" and the show date (demo clock). */
  showAfterSec: number;
  capacityScale: number;
  minCapacity: number;
  tourName: string;
  region: string;
}

export interface BookedShow extends PlannedShow {
  show: PublicKey;
  date: number;
  thresholdDeadline: number;
}

export interface CrewOffer {
  crewId: string;
  name: string;
  role: string;
  city: string;
  askBps: number;
  rating: number;
  yearsExperience: number;
  address: string;
  show: string;
}

/**
 * The band's agent: broadcasts the brief, collects venue offers, plans the
 * route, proposes shows on-chain, and hires crew for confirmed shows.
 */
export class BandAgent {
  readonly id: string;
  readonly bandProfile: PublicKey;
  readonly booked: BookedShow[] = [];

  constructor(
    readonly band: Band,
    readonly keypair: Keypair,
    private readonly client: GreenroomClient,
    private readonly bus: MessageBus,
    private readonly brain: Brain,
    private readonly cities: City[]
  ) {
    this.id = `band:${band.id}`;
    this.bandProfile = bandPda(keypair.publicKey, client.programId);
  }

  async requestOffers(brief: TourBrief, collectMs = 1500): Promise<VenueOffer[]> {
    const record = await this.client.fetchBand(this.bandProfile);
    const req: TourRequest = {
      bandId: this.band.id,
      bandName: this.band.name,
      bandAuthority: this.keypair.publicKey.toBase58(),
      genre: this.band.genre,
      draw: this.band.draw,
      countries: brief.countries,
      windowDays: brief.windowDays,
      targetPriceLamports: this.band.targetPriceLamports,
      trackRecord: {
        showsCompleted: record.showsCompleted,
        ticketsSoldTotal: Number(record.ticketsSoldTotal),
        grossSettledLamports: Number(record.grossSettledLamports),
      },
    };
    const pending = this.bus.collect<VenueOffer>("venue.offer", collectMs, this.id);
    this.bus.publish<TourRequest>({
      kind: "tour.request",
      from: this.id,
      text: `${this.band.name} (${this.band.genre}) wants ${brief.wantedShows} shows across ${brief.countries.join("/")} in a ${brief.windowDays}-day window. We draw about ${this.band.draw} people; on-chain record: ${record.showsCompleted} settled shows, ${record.ticketsSoldTotal} tickets.`,
      data: req,
    });
    const offers = (await pending).map((m) => m.data!);
    return offers;
  }

  async plan(brief: TourBrief, offers: VenueOffer[]): Promise<PlannedShow[]> {
    const decision = await this.brain.decide<{ cities: string[] }>({
      agent: this.id,
      title: "choose route",
      system: `You are the tour manager agent of ${this.band.name}. Pick cities that make geographic sense (short hops), prefer venues whose size fits a draw of ${this.band.draw}, and prefer lower venue shares. Return the ordered list of city names.`,
      prompt: `Offers: ${JSON.stringify(
        offers.map((o) => ({ city: o.city, country: o.country, venue: o.venueId, cap: o.offeredCapacity, askBps: o.askBps, freeDays: o.availableDays.length }))
      )}. Wanted: ${brief.wantedShows} shows in ${brief.windowDays} days.`,
      schema: { cities: "string[] ordered", reasoning: "string" },
      heuristic: () => {
        const plan = planTour({
          band: this.band,
          offers,
          cities: this.cities,
          wantedShows: brief.wantedShows,
          windowDays: brief.windowDays,
          startCity: brief.startCity,
          thresholdBps: brief.thresholdBps,
          capacityScale: brief.capacityScale,
          minCapacity: brief.minCapacity,
        });
        return { value: { cities: plan.map((p) => p.city) }, reasoning: `Planned by fit and distance: ${describePlan(plan)}` };
      },
      validate: (x) => (x.cities.some((c) => !offers.find((o) => o.city === c)) ? "unknown city" : null),
    });

    // The model may reorder or drop cities; the deterministic planner then
    // re-validates availability and computes days, capacities and terms.
    const chosen = decision.value.cities;
    const filtered = offers.filter((o) => chosen.includes(o.city));
    const plan = planTour({
      band: this.band,
      offers: filtered,
      cities: this.cities,
      wantedShows: brief.wantedShows,
      windowDays: brief.windowDays,
      startCity: chosen[0] ?? brief.startCity,
      thresholdBps: brief.thresholdBps,
      capacityScale: brief.capacityScale,
      minCapacity: brief.minCapacity,
    });
    this.bus.publish({
      kind: "band.plan",
      from: this.id,
      text: `${decision.reasoning}`,
      data: { plan, source: decision.source },
    });
    return plan;
  }

  async book(brief: TourBrief, plan: PlannedShow[], salesOpenAt: number): Promise<{ tour: PublicKey; tourId: number }> {
    const record = await this.client.fetchBand(this.bandProfile);
    const tourId = record.toursCreated;
    const windowStart = salesOpenAt - 60;
    const windowEnd = salesOpenAt + brief.showAfterSec + brief.windowDays * 2 + 3600;
    const { tour, sig } = await this.client.createTour(this.keypair, tourId, brief.tourName, brief.region, windowStart, windowEnd);
    this.bus.publish({ kind: "note", from: this.id, text: `Tour "${brief.tourName}" opened on-chain (#${tourId}).`, tx: sig, data: { tour: tour.toBase58(), tourId } });

    for (const p of plan) {
      // demo clock: every show's deadline/date are offsets from sales opening,
      // spread by the planned day so the dashboard shows a sequence
      const thresholdDeadline = salesOpenAt + brief.deadlineAfterSec + p.day;
      const date = salesOpenAt + brief.showAfterSec + p.day * 2;
      try {
        const { show, sig: psig } = await this.client.proposeShow(this.keypair, tour, new PublicKey(p.venuePubkey), {
          date,
          ticketPriceLamports: p.ticketPriceLamports,
          capacity: p.capacity,
          thresholdBps: p.thresholdBps,
          thresholdDeadline,
          bandBps: p.bandBps,
          venueBps: p.venueBps,
        });
        const booked: BookedShow = { ...p, show, date, thresholdDeadline };
        this.booked.push(booked);
        this.bus.publish<ShowProposedData>({
          kind: "show.proposed",
          from: this.id,
          to: `venue:${p.venueId}`,
          text: `Proposed ${p.city} on day ${p.day}: ${p.capacity} tickets at ${p.ticketPriceLamports} lamports, ${p.venueBps / 100}% to the venue, ${p.thresholdBps / 100}% threshold.`,
          tx: psig,
          data: {
            show: show.toBase58(),
            venuePubkey: p.venuePubkey,
            venueId: p.venueId,
            city: p.city,
            day: p.day,
            capacity: p.capacity,
            ticketPriceLamports: p.ticketPriceLamports,
            venueBps: p.venueBps,
            bandBps: p.bandBps,
            thresholdBps: p.thresholdBps,
            bandAuthority: this.keypair.publicKey.toBase58(),
            bandName: this.band.name,
          },
        });
      } catch (e) {
        this.bus.publish({ kind: "note", from: this.id, text: `could not propose ${p.city}: ${(e as Error).message.slice(0, 160)}` });
      }
    }
    return { tour, tourId };
  }

  /** Pick crew from the offers for one confirmed show and add them as payees. */
  async hireCrew(show: BookedShow, offers: CrewOffer[], maxHires = 2, maxTotalBps = 1500): Promise<CrewOffer[]> {
    if (offers.length === 0) return [];
    const decision = await this.brain.decide<{ hire: string[] }>({
      agent: this.id,
      title: `hire crew in ${show.city}`,
      system: `You are the tour manager agent of ${this.band.name}. Hire at most ${maxHires} local crew for a confirmed show, different roles, best rating per bps asked, total at most ${maxTotalBps} bps of the show revenue.`,
      prompt: `Offers in ${show.city}: ${JSON.stringify(offers.map((o) => ({ id: o.crewId, role: o.role, askBps: o.askBps, rating: o.rating, years: o.yearsExperience })))}`,
      schema: { hire: "string[] of crew ids", reasoning: "string" },
      heuristic: () => {
        const ranked = [...offers].sort((a, b) => b.rating / b.askBps - a.rating / a.askBps);
        const picked: CrewOffer[] = [];
        const roles = new Set<string>();
        let bps = 0;
        for (const o of ranked) {
          if (picked.length >= maxHires) break;
          if (roles.has(o.role) || bps + o.askBps > maxTotalBps) continue;
          picked.push(o);
          roles.add(o.role);
          bps += o.askBps;
        }
        return {
          value: { hire: picked.map((p) => p.crewId) },
          reasoning: picked.length ? `Hiring ${picked.map((p) => `${p.name} (${p.role}, ${p.rating}★, ${p.askBps / 100}%)`).join(" and ")} for ${show.city}.` : `No crew offer in ${show.city} was worth the share.`,
        };
      },
      validate: (x) => {
        const chosen = offers.filter((o) => x.hire.includes(o.crewId));
        if (chosen.length > maxHires) return "too many hires";
        if (chosen.reduce((s, o) => s + o.askBps, 0) > maxTotalBps) return "total bps too high";
        if (new Set(chosen.map((o) => o.role)).size !== chosen.length) return "duplicate roles";
        return null;
      },
    });
    const hired: CrewOffer[] = [];
    for (const id of decision.value.hire) {
      const o = offers.find((x) => x.crewId === id);
      if (!o) continue;
      try {
        const tx = await this.client.addPayee(this.keypair, show.show, new PublicKey(o.address), o.askBps, o.role.slice(0, 16));
        hired.push(o);
        this.bus.publish({
          kind: "crew.hired",
          from: this.id,
          to: `crew:${o.crewId}`,
          text: `Hired ${o.name} as ${o.role} for ${show.city} at ${o.askBps / 100}% of the show (${o.rating}★, ${o.yearsExperience} yrs). ${hired.length === 1 ? decision.reasoning : ""}`.trim(),
          tx,
          data: { show: show.show.toBase58(), crewId: o.crewId, role: o.role, askBps: o.askBps, city: show.city },
        });
      } catch (e) {
        this.bus.publish({ kind: "note", from: this.id, text: `could not add payee ${o.name}: ${(e as Error).message.slice(0, 120)}` });
      }
    }
    return hired;
  }
}

export function crewOffersFor(show: BookedShow, crew: CrewProfile[], addressOf: (c: CrewProfile) => string, limit = 6): CrewOffer[] {
  return crew
    .filter((c) => c.city === show.city && c.rating >= 3.5)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit)
    .map((c) => ({
      crewId: c.id,
      name: c.name,
      role: c.role,
      city: c.city,
      askBps: c.askBps,
      rating: c.rating,
      yearsExperience: c.yearsExperience,
      address: addressOf(c),
      show: show.show.toBase58(),
    }));
}
