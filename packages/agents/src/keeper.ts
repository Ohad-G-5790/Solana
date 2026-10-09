/**
 * The network's keeper: what happens after a band books a tour from the
 * dashboard. Each run (a few minutes, on a schedule) it
 *   1. registers seed venues that are not on-chain yet,
 *   2. has each venue's agent sign the shows proposed to it,
 *   3. lets simulated fans near each city buy tickets,
 *   4. runs the permissionless crank: confirm, cancel, refund, settle.
 * The band never hands over a key: it signed its own proposals in the browser.
 *
 * Demo only: the seed venues' keys derive from the public world seed, so
 * anyone can sign as them; the keeper refuses to run on mainnet. It accepts a
 * proposal only on the terms a venue would offer (venueTermsProblems) and
 * rejects the rest. What the demo wallet spends on fans is bounded twice: a
 * show sells at most its capacity (40 tickets at most 200 € each, KEEPER_RULES),
 * and each run spends at most maxFanSolPerRun, ticket rent included. A fresh
 * band wallet gets no more than any other; the payer floor stops fans entirely.
 */
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { generateWorld, type Band, type Venue } from "@greenroom/world";
import { GreenroomClient, keypairFromSeedHex, showStateName, venuePda, type ShowAccount } from "@greenroom/sdk";
import type { BookedShow } from "./band-agent.ts";
import { MessageBus } from "./bus.ts";
import { Crank } from "./crank.ts";
import { FanSim } from "./fan-sim.ts";
import { venueOfferHeuristic } from "./offers.ts";
import { formatSol } from "./sol.ts";

/** What a seed venue accepts from a dashboard booking (book.ts proposes inside these). */
export const KEEPER_RULES = {
  minPriceLamports: 10_000, // 1 € in the demo's play money
  maxPriceLamports: 2_000_000, // 200 €
  maxCapacity: 40, // the devnet sample of a room
  minThresholdBps: 3000,
  /** Two live shows at one venue less than one demo day apart (2 s on chain) are a double booking. */
  sameDateSec: 2,
  /** Sales must run at least this long after the proposal, and end within maxSalesSec. */
  minSalesSec: 600,
  maxSalesSec: 6 * 3600,
  /** The show is at most this long after its deadline. */
  maxShowAfterDeadlineSec: 24 * 3600,
};

export type KeeperRules = typeof KEEPER_RULES;

export interface ProposalTerms {
  venueBps: number;
  ticketPriceLamports: number;
  capacity: number;
  thresholdBps: number;
  date: number;
  thresholdDeadline: number;
}

/** On devnet a show sells a 5% sample of the room (book.ts); the band's draw behind a capacity. */
const drawBehind = (capacity: number) => capacity * 20;

/** Why a seed venue would say no to these terms; empty when it signs. */
export function venueTermsProblems(
  venue: Pick<Venue, "id" | "name" | "city" | "country" | "capacity" | "lat" | "lng" | "genres">,
  band: { genre: string; showsCompleted: number; ticketsSoldTotal: number },
  p: ProposalTerms,
  otherDatesAtVenue: number[],
  now?: number,
  rules: KeeperRules = KEEPER_RULES
): string[] {
  // the venue agent's own rule, as it would have answered the band's request
  const d = venueOfferHeuristic(venue, { genre: band.genre, draw: drawBehind(p.capacity), targetPriceLamports: p.ticketPriceLamports, trackRecord: band });
  const out: string[] = [];
  // at the sample cap the band's draw is unknown (it may be far bigger), so only judge fit below it
  if (p.capacity < rules.maxCapacity && !d.offer && !venue.genres.includes(band.genre as never)) out.push(`${band.genre} is off our programme for a band this size`);
  // the browser may have used a lower ask (a strong track record measured against the real draw): allow that discount
  if (p.venueBps < d.askBps - 500) out.push(`venue share ${p.venueBps / 100}% below the ${d.askBps / 100}% we ask`);
  if (p.ticketPriceLamports < rules.minPriceLamports || p.ticketPriceLamports > rules.maxPriceLamports) out.push("ticket price outside 1-200 €");
  if (p.capacity > Math.min(venue.capacity, rules.maxCapacity)) out.push(`capacity ${p.capacity} above what we sell on devnet`);
  if (p.thresholdBps < rules.minThresholdBps) out.push(`threshold ${p.thresholdBps / 100}% too low`);
  if (now !== undefined) {
    const sales = p.thresholdDeadline - now;
    if (sales < rules.minSalesSec || sales > rules.maxSalesSec) out.push("ticket sales too short or too long for us to sign");
  }
  if (p.date - p.thresholdDeadline > rules.maxShowAfterDeadlineSec) out.push("the show is too long after sales close");
  if (otherDatesAtVenue.some((x) => Math.abs(x - p.date) < rules.sameDateSec)) out.push("we already have a show that night");
  return out;
}

export interface KeeperOptions {
  rpcUrl: string;
  /** Pays fees, venue registration and the simulated fans' tickets. */
  payer: Keypair;
  /** How long this run keeps going. */
  minutes: number;
  tickMs?: number;
  fansPerCity?: number;
  /** Venues to register per run at most (each costs ~0.003 SOL once). */
  registerVenues?: number;
  /** Seconds between sales opening and the deadline, used to pace fans (the dashboard books with 40 min). */
  salesWindowSec?: number;
  /** Most the payer spends on simulated fans in one run (SOL), ticket rent included. */
  maxFanSolPerRun?: number;
  /** Overrides, e.g. shorter sales windows for tests on a fast fake clock. */
  rules?: Partial<KeeperRules>;
  log?: (line: string) => void;
  /** Tests inject an in-memory chain. */
  deps?: { client: GreenroomClient; connection: Pick<Connection, "getBalance" | "getMultipleAccountsInfo"> };
}

/** Rent of one Ticket account, paid by the payer and not returned to it. */
const TICKET_RENT_LAMPORTS = 1_800_000;

const MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runKeeper(opts: KeeperOptions): Promise<{ accepted: number; rejected: number; ticketsBought: number; confirmed: number; cancelled: number; refunded: number; settled: number; failedTicks: number; okTicks: number }> {
  const log = opts.log ?? ((l: string) => console.log(l));
  const connection = opts.deps?.connection ?? new Connection(opts.rpcUrl, "confirmed");
  const client = opts.deps?.client ?? GreenroomClient.fromKeypair(connection as Connection, opts.payer);
  // local validators and injected test chains need no rate-limit pacing
  const isLocal = /127\.0\.0\.1|localhost/.test(opts.rpcUrl) || !!opts.deps;
  if (!opts.deps && (await (connection as Connection).getGenesisHash()) === MAINNET_GENESIS) throw new Error("the keeper signs with public demo venue keys: devnet or localnet only");
  const world = generateWorld({ seed: "greenroom-2026", bands: 1, crewPerCity: 1, fansPerCity: opts.fansPerCity ?? 10, basePriceLamports: isLocal ? 0.01 * LAMPORTS_PER_SOL : 0.001 * LAMPORTS_PER_SOL });
  const bus = new MessageBus();
  bus.on("*", (m) => log(`[${m.kind}] ${m.from}: ${m.text}${m.tx ? ` (tx ${m.tx.slice(0, 8)}…)` : ""}`));
  const stats = { accepted: 0, rejected: 0, ticketsBought: 0, confirmed: 0, cancelled: 0, refunded: 0, settled: 0, failedTicks: 0, okTicks: 0 };
  // what the payer spent on fans this run, in all
  let spentTotal = 0;
  const priceOf = new Map<string, { band: string; price: number }>();
  bus.on("fan.bought", (m) => {
    stats.ticketsBought++;
    const d = m.data as { show: string; quantity: number };
    const p = priceOf.get(d.show);
    if (!p) return;
    spentTotal += d.quantity * p.price + TICKET_RENT_LAMPORTS;
  });
  const rules: KeeperRules = { ...KEEPER_RULES, ...opts.rules };
  let capNoted = false;
  const perRun = (opts.maxFanSolPerRun ?? 0.3) * LAMPORTS_PER_SOL;

  const byProfile = new Map<string, { venue: Venue; kp: Keypair }>();
  for (const v of world.venues) {
    const kp = keypairFromSeedHex(v.seed);
    byProfile.set(venuePda(kp.publicKey, client.programId).toBase58(), { venue: v, kp });
  }

  // 1. venues that are not on-chain yet
  try {
    const profiles = [...byProfile.keys()].map((k) => new PublicKey(k));
    const missing: { venue: Venue; kp: Keypair }[] = [];
    for (let i = 0; i < profiles.length; i += 100) {
      const infos = await connection.getMultipleAccountsInfo(profiles.slice(i, i + 100));
      infos.forEach((info, j) => {
        if (!info) missing.push(byProfile.get(profiles[i + j].toBase58())!);
      });
    }
    const toRegister = missing.slice(0, opts.registerVenues ?? 40);
    if (toRegister.length) await registerVenues(toRegister, missing.length);
  } catch (e) {
    log(`venue registration skipped this run: ${(e as Error).message.slice(0, 120)}`);
  }

  async function registerVenues(toRegister: { venue: Venue; kp: Keypair }[], missing: number) {
    log(`registering ${toRegister.length} of ${missing} missing venues`);
    // fund only venue keys that cannot pay their own rent yet (a failed registration keeps its SOL)
    const rent = (isLocal ? 1 : 0.003) * LAMPORTS_PER_SOL;
    const wallets = await connection.getMultipleAccountsInfo(toRegister.map((m) => m.kp.publicKey));
    const poor = toRegister.filter((_, i) => (wallets[i]?.lamports ?? 0) < rent / 2);
    if (poor.length) await client.transferSolMany(opts.payer, poor.map((m) => ({ to: m.kp.publicKey, sol: rent / LAMPORTS_PER_SOL })));
    for (const { venue: v, kp } of toRegister) {
      try {
        await client.registerVenue(kp, v.name.slice(0, 32), v.city.slice(0, 32), v.lat, v.lng, v.capacity);
      } catch (e) {
        log(`venue ${v.id}: ${(e as Error).message.slice(0, 100)}`);
      }
      if (!isLocal) await sleep(300);
    }
  }

  // 2-4. the loop
  const crank = new Crank(client, bus);
  const fanSims = new Map<string, FanSim>();
  const bands = new Map<string, Band>();
  const window = opts.salesWindowSec ?? 2400;
  const end = Date.now() + opts.minutes * 60_000;
  const bandInfo = async (profile: string) => {
    if (!bands.has(profile)) {
      const b = await client.fetchBand(new PublicKey(profile));
      bands.set(profile, { ...world.bands[0], id: profile, name: b.name, genre: b.genre as Band["genre"], showsCompleted: b.showsCompleted, ticketsSoldTotal: Number(b.ticketsSoldTotal) } as Band);
    }
    return bands.get(profile)! as Band & { showsCompleted: number; ticketsSoldTotal: number };
  };
  const terms = (s: ShowAccount): ProposalTerms => ({ venueBps: s.venueBps, ticketPriceLamports: Number(s.ticketPriceLamports), capacity: s.capacity, thresholdBps: s.thresholdBps, date: Number(s.date), thresholdDeadline: Number(s.thresholdDeadline) });
  let backoffMs = 0;
  while (Date.now() < end) {
    try {
      const now = await client.chainTime();
      // only shows that can still change: settled ones never need the keeper again
      // (state byte at offset 218; base58 of 0..3 is "1".."4")
      const reads = (await Promise.all(["1", "2", "3", "4"].map((b) => client.program.account.show.all([{ memcmp: { offset: 218, bytes: b } }])))).flat();
      // a show that changed state between two reads would appear twice
      const all = [...new Map(reads.map((r) => [r.publicKey.toBase58(), r])).values()];
      const accounts = new Map<string, ShowAccount>(all.map((s) => [s.publicKey.toBase58(), s.account]));
      // live dates per venue, for double bookings
      const liveDates = new Map<string, { show: string; date: number }[]>();
      for (const { publicKey, account: s } of all) {
        if (!["onSale", "confirmed"].includes(showStateName(s.state))) continue;
        const k = s.venueProfile.toBase58();
        liveDates.set(k, [...(liveDates.get(k) ?? []), { show: publicKey.toBase58(), date: Number(s.date) }]);
      }
      const work: PublicKey[] = [];
      const selling = new Map<string, Parameters<FanSim["tick"]>[0]>();
      for (const { publicKey, account: s } of all) {
        const state = showStateName(s.state);
        const venue = byProfile.get(s.venueProfile.toBase58());
        if (state === "proposed") {
          if (!venue || now >= Number(s.thresholdDeadline)) continue;
          const vKey = s.venueProfile.toBase58();
          try {
            const band = await bandInfo(s.bandProfile.toBase58());
            const problems = venueTermsProblems(venue.venue, band, terms(s), (liveDates.get(vKey) ?? []).map((d) => d.date), now, rules);
            if (problems.length) {
              const tx = await client.rejectShow(venue.kp, publicKey, s.bandAuthority);
              stats.rejected++;
              bus.publish({ kind: "show.rejected", from: `venue:${venue.venue.id}`, text: `${venue.venue.name} said no: ${problems.join("; ")}.`, tx, data: { show: publicKey.toBase58() } });
            } else {
              const tx = await client.acceptShow(venue.kp, publicKey);
              stats.accepted++;
              liveDates.set(vKey, [...(liveDates.get(vKey) ?? []), { show: publicKey.toBase58(), date: Number(s.date) }]);
              bus.publish({ kind: "show.accepted", from: `venue:${venue.venue.id}`, text: `${venue.venue.name} signed the show (${s.capacity} tickets).`, tx, data: { show: publicKey.toBase58() } });
            }
          } catch (e) {
            log(`answer ${publicKey.toBase58().slice(0, 8)}: ${(e as Error).message.slice(0, 100)}`);
          }
          continue;
        }
        if (state === "settled") continue;
        if (state === "cancelled" && s.ticketsRefunded >= s.ticketsSold) continue;
        if (state === "confirmed" && now < Number(s.date) && s.ticketsSold >= s.capacity) continue;
        work.push(publicKey);
        // fans buy while sales are open
        const open = (state === "onSale" && now < Number(s.thresholdDeadline)) || (state === "confirmed" && now < Number(s.date));
        // fans only for shows a seed venue would have signed (its keys are public, so check again)
        const fair = open && venue && venueTermsProblems(venue.venue, await bandInfo(s.bandProfile.toBase58()), terms(s), [], undefined, rules).length === 0;
        if (fair && venue) {
          const key = s.bandProfile.toBase58();
          priceOf.set(publicKey.toBase58(), { band: key, price: Number(s.ticketPriceLamports) });
          const progress = Math.min(1, Math.max(0, 1 - (Number(s.thresholdDeadline) - now) / window));
          const booked = { show: publicKey, city: venue.venue.city, ticketPriceLamports: Number(s.ticketPriceLamports) } as unknown as BookedShow;
          selling.set(key, [...(selling.get(key) ?? []), { booked, state, ticketsSold: s.ticketsSold, capacity: s.capacity, progress }]);
        }
      }
      const balance = await connection.getBalance(opts.payer.publicKey);
      if (balance > 0.02 * LAMPORTS_PER_SOL) {
        for (const [bandProfile, views] of selling) {
          if (spentTotal >= perRun) {
            if (!capNoted) log(`fan budget for this run reached (${formatSol(spentTotal)} incl. ticket rent); fans resume next run`);
            capNoted = true;
            break;
          }
          if (!fanSims.has(bandProfile)) {
            fanSims.set(bandProfile, new FanSim(bands.get(bandProfile)!, world.fans, world.cities, client, bus, { maxBuysPerTick: isLocal ? 40 : 10, radiusKm: 80, seed: `keeper:${bandProfile}`, concurrency: isLocal ? 6 : 1, gapMs: isLocal ? 0 : 300 }));
          }
          await fanSims.get(bandProfile)!.tick(views);
        }
      } else {
        log(`payer balance ${formatSol(balance)}: fans paused, fund ${opts.payer.publicKey.toBase58()}`);
      }
      const r = await crank.run(work, now, accounts);
      stats.confirmed += r.confirmed.length;
      stats.cancelled += r.cancelled.length;
      stats.refunded += r.refunded;
      stats.settled += r.settled.length;
      stats.okTicks++;
      backoffMs = 0;
    } catch (e) {
      stats.failedTicks++;
      // a busy public RPC answers 429: wait longer each time, up to two minutes
      backoffMs = Math.min(120_000, backoffMs ? backoffMs * 2 : 5_000);
      log(`tick failed (retrying in ${backoffMs / 1000}s): ${(e as Error).message.slice(0, 120)}`);
    }
    await sleep((opts.tickMs ?? (isLocal ? 2000 : 15_000)) + (isLocal ? 0 : backoffMs));
  }
  return stats;
}
