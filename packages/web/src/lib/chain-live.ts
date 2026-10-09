"use client";

import { BorshCoder, EventParser, type Idl } from "@anchor-lang/core";
import { PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";
import type { Greenroom } from "@/idl/greenroom";
import idl from "@/idl/greenroom.json";
import { bandPda, connection, programId, readProgram, stateName } from "./greenroom";
import type { FeedMessage, RunShow, RunSummary } from "./run";

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

async function venuesByProfile(): Promise<Map<string, VenueInfo>> {
  if (venueCache) return venueCache;
  const all = await readProgram().account.venueProfile.all();
  venueCache = new Map(
    all.map((v) => [
      v.publicKey.toBase58(),
      { name: v.account.name, city: v.account.city, venueId: `${v.account.name} ${v.account.city}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") },
    ])
  );
  return venueCache;
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
      day: Math.max(0, Math.round((Number(s.account.date) - firstDate) / 2)),
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

const parser = new EventParser(programId, new BorshCoder(idl as Idl));
const seen = new Map<string, FeedMessage[]>(); // signature -> decoded messages
let nextId = 1_000_000;

const describe: Record<string, (d: Record<string, unknown>, venues: Map<string, VenueInfo>) => string> = {
  BandRegistered: (d) => `${d.name} registered its band profile.`,
  VenueRegistered: (d) => `${d.name} (${d.city}) registered as a venue, capacity ${d.capacity}.`,
  TourCreated: (d) => `Tour "${d.name}" opened (#${d.tourId}).`,
  ShowProposed: (d, v) => `Proposed ${v.get(String(d.venueProfile))?.city ?? "a show"}: ${d.capacity} tickets, ${Number(d.thresholdBps) / 100}% threshold.`,
  ShowAccepted: () => `Venue signed: the show is on sale.`,
  ShowRejected: () => `Venue declined the proposal; the show was closed.`,
  TicketBought: (d) => `Fan ${String(d.buyer).slice(0, 6)}… bought ${d.quantity} ticket${Number(d.quantity) > 1 ? "s" : ""} (${d.ticketsSold} sold so far).`,
  ShowConfirmed: (d) => `Threshold met (${d.ticketsSold}/${d.capacity}): show confirmed.`,
  ShowCancelled: (d) => `Deadline passed with ${d.ticketsSold} sold (needed ${d.ticketsRequired}): show cancelled, refunds follow.`,
  TicketRefunded: (d) => `Refunded ${Number(d.amountLamports) / 1e9} SOL to ${String(d.buyer).slice(0, 6)}….`,
  ShowSettled: (d) => `Settled ${Number(d.totalLamports) / 1e9} SOL: band ${Number(d.bandLamports) / 1e9}, venue ${Number(d.venueLamports) / 1e9}, crew ${Number(d.payeeLamports) / 1e9}.`,
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

function decode(sig: string, tx: ParsedTransactionWithMeta | null, venues: Map<string, VenueInfo>): FeedMessage[] {
  if (!tx?.meta?.logMessages) return [];
  const out: FeedMessage[] = [];
  for (const ev of parser.parseLogs(tx.meta.logMessages)) {
    const data = ev.data as Record<string, unknown>;
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
  const missing = sigs.filter((s) => !seen.has(s.signature) && !s.err).map((s) => s.signature);
  if (missing.length) {
    const venues = await venuesByProfile();
    for (let i = 0; i < missing.length; i += 5) {
      const batch = missing.slice(i, i + 5);
      const txs = await connection.getParsedTransactions(batch, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
      batch.forEach((sig, j) => seen.set(sig, decode(sig, txs[j], venues)));
    }
  }
  const ordered = [...sigs].reverse();
  const out: FeedMessage[] = [];
  for (const s of ordered) for (const m of seen.get(s.signature) ?? []) out.push(m);
  lastEvents = { at: Date.now(), value: out };
  return out;
}

export type { Greenroom };
