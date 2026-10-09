"use client";

import { BorshCoder, EventParser, type Idl } from "@anchor-lang/core";
import { PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";
import type { Greenroom } from "@/idl/greenroom";
import idl from "@/idl/greenroom.json";
import { bandPda, connection, programId, readProgram, stateName } from "./greenroom";
import { getWorld, type FeedMessage, type RunShow, type RunSummary } from "./run";
import { DEMO_DAY_SEC } from "./config";
import { venueKeys } from "./venue-keys";

/**
 * Live mode: everything the dashboard shows comes from chain state and the
 * program's events, so a run executing anywhere (GitHub Actions, another
 * machine) is visible here as it happens. The bundled transcript only
 * supplies what never touches the chain (venue offers and declines).
 */

const enc = (s: string) => Buffer.from(s);
const u32le = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};

export interface VenueInfo {
  name: string;
  city: string;
  venueId: string;
}

let venueCache: Map<string, VenueInfo> | null = null;

/** Venue names by VenueProfile address, from the published seed venues (no getProgramAccounts on a public RPC). */
async function venuesByProfile(): Promise<Map<string, VenueInfo>> {
  if (venueCache) return venueCache;
  const [keys, world] = await Promise.all([venueKeys(), getWorld()]);
  const byId = new Map(world.venues.map((v) => [v.id, v]));
  const map = new Map<string, VenueInfo>();
  for (const [profile, id] of keys.byProfile) {
    const v = byId.get(id);
    const info = { name: v?.name ?? id, city: v?.city ?? "?", venueId: id };
    map.set(profile, info);
    // events such as ShowAccepted name the venue's authority, not its profile
    const authority = keys.byId.get(id)?.authority;
    if (authority) map.set(authority, info);
  }
  if (map.size) venueCache = map; // an empty answer (failed load) is retried next time
  return map;
}

const tourCache = new Map<string, { at: number; value: RunSummary | null }>();

/** Latest tour of a band and its shows, straight from chain state (cached 30 s; getProgramAccounts is expensive on public RPCs). */
export async function fetchLiveTour(bandAuthority: string): Promise<RunSummary | null> {
  const cached = tourCache.get(bandAuthority);
  if (cached && Date.now() - cached.at < 30_000) return cached.value;
  const value = await fetchLiveTourUncached(bandAuthority);
  tourCache.set(bandAuthority, { at: Date.now(), value });
  return value;
}

async function fetchLiveTourUncached(bandAuthority: string): Promise<RunSummary | null> {
  const program = readProgram();
  const authority = new PublicKey(bandAuthority);
  const profile = bandPda(authority);
  const band = await program.account.bandProfile.fetchNullable(profile);
  if (!band || band.toursCreated === 0) return null;
  const tourId = band.toursCreated - 1;
  const tour = PublicKey.findProgramAddressSync([enc("tour"), profile.toBuffer(), u32le(tourId)], programId)[0];
  const shows = await program.account.show.all([{ memcmp: { offset: 8, bytes: tour.toBase58() } }]);
  const venues = await venuesByProfile();
  const sorted = [...shows].sort((a, b) => Number(a.account.date) - Number(b.account.date));
  const firstDate = sorted.length ? Number(sorted[0].account.date) : 0;
  const runShows: RunShow[] = sorted.map((s) => {
    const v = venues.get(s.account.venueProfile.toBase58());
    return {
      show: s.publicKey.toBase58(),
      city: v?.city ?? "?",
      venue: v?.venueId ?? s.account.venueProfile.toBase58().slice(0, 8),
      venueName: v?.name,
      ticketPriceLamports: Number(s.account.ticketPriceLamports),
      venueBps: s.account.venueBps,
      thresholdBps: s.account.thresholdBps,
      day: Math.max(0, Math.round((Number(s.account.date) - firstDate) / DEMO_DAY_SEC)),
      capacity: s.account.capacity,
      ticketsSold: s.account.ticketsSold,
      state: stateName(s.account.state),
      date: Number(s.account.date),
      thresholdDeadline: Number(s.account.thresholdDeadline),
      payees: s.account.payees.map((p) => ({ label: p.label, bps: p.bps })),
    };
  });
  return {
    runId: `live-tour-${tourId}`,
    cluster: "live",
    band: { id: band.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name: band.name, authority: bandAuthority, profile: profile.toBase58() },
    tour: tour.toBase58(),
    shows: runShows,
    stats: { ticketsSold: runShows.reduce((n, s) => n + s.ticketsSold, 0), live: 1 },
  };
}

// ---------- program events from recent transactions ----------

const sol = (l: number) => `${(l / 1e9).toLocaleString("en", { maximumFractionDigits: 5 })} SOL`;
const parser = new EventParser(programId, new BorshCoder(idl as Idl));
const seen = new Map<string, FeedMessage[]>(); // signature -> decoded messages
let nextId = 1_000_000;

const describe: Record<string, (d: Record<string, unknown>, venues: Map<string, VenueInfo>) => string> = {
  BandRegistered: (d) => `${d.name} registered its band profile.`,
  VenueRegistered: (d) => `${d.name} (${d.city}) registered as a venue, capacity ${d.capacity}.`,
  TourCreated: (d) => `Tour "${d.name}" opened (#${d.tourId}).`,
  ShowProposed: (d, v) => `Proposed ${v.get(String(d.venueProfile))?.city ?? "a show"}: ${d.capacity} tickets, ${Number(d.thresholdBps) / 100}% threshold.`,
  ShowAccepted: (d, v) => `${v.get(String(d.venueAuthority))?.name ?? "The venue"} signed: ${v.get(String(d.venueAuthority))?.city ?? "the show"} is on sale.`,
  ShowRejected: () => `Venue declined the proposal; the show was closed.`,
  TicketBought: (d) => `A fan bought ${d.quantity} ticket${Number(d.quantity) > 1 ? "s" : ""} (${d.ticketsSold} sold so far).`,
  ShowConfirmed: (d) => `Threshold met (${d.ticketsSold}/${d.capacity}): show confirmed.`,
  ShowCancelled: (d) => `Deadline passed with ${d.ticketsSold} sold (needed ${d.ticketsRequired}): show cancelled, refunds follow.`,
  TicketRefunded: (d) => `A fan got ${sol(Number(d.amountLamports))} back.`,
  ShowSettled: (d) => `Paid out ${sol(Number(d.totalLamports))}: band ${sol(Number(d.bandLamports))}, venue ${sol(Number(d.venueLamports))}${Number(d.payeeLamports) ? `, crew ${sol(Number(d.payeeLamports))}` : ""}.`,
  PayeeAdded: (d) => `Crew hired: ${d.label} for ${Number(d.bps) / 100}% of the show.`,
};

const kindOf: Record<string, string> = {
  ShowProposed: "show.proposed",
  ShowAccepted: "show.accepted",
  ShowRejected: "show.rejected",
  TicketBought: "fan.bought",
  ShowConfirmed: "crank.confirmed",
  ShowCancelled: "crank.cancelled",
  TicketRefunded: "crank.refunded",
  ShowSettled: "crank.settled",
  PayeeAdded: "crew.hired",
};

/** Event fields come back in the IDL's snake_case; expose them as camelCase too. */
function camel(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const [k, v] of Object.entries(data)) out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  return out;
}

function decode(sig: string, tx: ParsedTransactionWithMeta | null, venues: Map<string, VenueInfo>): FeedMessage[] {
  if (!tx?.meta?.logMessages) return [];
  const out: FeedMessage[] = [];
  for (const ev of parser.parseLogs(tx.meta.logMessages)) {
    const data = camel(ev.data as Record<string, unknown>);
    const text = describe[ev.name]?.(data, venues) ?? `${ev.name}`;
    const show = typeof data.show === "object" && data.show ? String(data.show) : undefined;
    out.push({
      id: nextId++,
      at: (tx.blockTime ?? Math.floor(Date.now() / 1000)) * 1000,
      kind: kindOf[ev.name] ?? "note",
      from: ev.name.startsWith("Ticket") ? "fan" : ev.name.startsWith("Show") || ev.name === "PayeeAdded" ? "chain" : "chain",
      text,
      tx: sig,
      data: { ...data, show },
    });
  }
  return out;
}

/** The most recent program events, newest last. Cached per signature so polling stays cheap. */
let lastEvents: { at: number; value: FeedMessage[] } | null = null;

export async function fetchChainEvents(limit = 25): Promise<FeedMessage[]> {
  if (lastEvents && Date.now() - lastEvents.at < 12_000) return lastEvents.value;
  const sigs = await connection.getSignaturesForAddress(programId, { limit: Math.min(limit, 25) }, "confirmed");
  // Newest first, at most 6 new transactions per poll, one request at a time
  // with a pause: public RPCs cap getTransaction calls per second, and a
  // transaction we could not fetch now is simply fetched on a later poll.
  const missing = sigs.filter((s) => !seen.has(s.signature) && !s.err).map((s) => s.signature).slice(0, 6);
  if (missing.length) {
    const venues = await venuesByProfile();
    for (const sig of missing) {
      try {
        const tx = await connection.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
        seen.set(sig, decode(sig, tx, venues));
      } catch {
        break; // rate limited: try again next poll
      }
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  const ordered = [...sigs].reverse();
  const out: FeedMessage[] = [];
  for (const s of ordered) for (const m of seen.get(s.signature) ?? []) out.push(m);
  lastEvents = { at: Date.now(), value: out };
  return out;
}

/**
 * Events for one band's shows only (every instruction on a show touches its
 * account): the band's own activity, not the whole network's. Same caching and
 * pacing as fetchChainEvents.
 */
const showSigs = new Map<string, { at: number; sigs: { signature: string; err: unknown }[] }>();

export async function fetchShowEvents(shows: string[]): Promise<FeedMessage[]> {
  const all = new Map<string, number>(); // signature -> slot order
  let reached = 0;
  for (const show of shows.slice(0, 20)) {
    let cached = showSigs.get(show);
    if (!cached || Date.now() - cached.at > 20_000) {
      try {
        const sigs = await connection.getSignaturesForAddress(new PublicKey(show), { limit: 40 }, "confirmed");
        cached = { at: Date.now(), sigs: sigs.map((s) => ({ signature: s.signature, err: s.err })) };
        showSigs.set(show, cached);
        reached++;
      } catch {
        if (!cached) continue; // busy RPC: this show's history comes on a later poll
      }
    } else reached++;
    cached.sigs.forEach((s, i) => !s.err && all.set(s.signature, Math.min(all.get(s.signature) ?? Infinity, i)));
  }
  // nothing reachable at all: say so instead of "nothing happened"
  if (shows.length && reached === 0) throw new Error("devnet is busy");
  const missing = [...all.keys()].filter((s) => !seen.has(s)).slice(0, 8);
  if (missing.length) {
    const venues = await venuesByProfile();
    for (const sig of missing) {
      try {
        const tx = await connection.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
        seen.set(sig, decode(sig, tx, venues));
      } catch {
        break;
      }
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  const out: FeedMessage[] = [];
  for (const sig of all.keys()) for (const m of seen.get(sig) ?? []) out.push(m);
  return out.sort((a, b) => a.at - b.at || a.id - b.id);
}

export type { Greenroom };
