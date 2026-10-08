import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { generateWorld, type CrewProfile, type Venue, type World } from "@greenroom/world";
import { bandPda, GreenroomClient, keypairFromSeedHex, showStateName, venuePda } from "@greenroom/sdk";
import { BandAgent, crewOffersFor, type BookedShow, type CrewOffer, type TourBrief } from "./band-agent.ts";
import { makeBrain, type Brain } from "./brain.ts";
import { MessageBus } from "./bus.ts";
import { Crank } from "./crank.ts";
import { FanSim } from "./fan-sim.ts";
import { VenueAgent } from "./venue-agent.ts";

export interface RunOptions {
  rpcUrl: string;
  /** Fee payer + funder. On localnet it is airdropped; on devnet it must be funded already. */
  payer: Keypair;
  bandId?: string;
  countries?: string[];
  wantedShows?: number;
  windowDays?: number;
  /** Seconds from sales opening to the threshold deadline. */
  deadlineAfterSec?: number;
  /** Seconds from sales opening to the show date. */
  showAfterSec?: number;
  capacityScale?: number;
  minCapacity?: number;
  /** Max venues to put on-chain (all venues in the countries by default). */
  maxVenues?: number;
  fansPerCity?: number;
  crewPerCity?: number;
  /** Run a short "last year" tour first so the track record is real. */
  history?: boolean;
  brain?: Brain;
  runDir?: string;
  seed?: string;
  /** Fan purchases per tick (devnet: keep small). */
  maxBuysPerTick?: number;
  tickMs?: number;
  log?: (line: string) => void;
}

export interface RunSummary {
  runId: string;
  cluster: string;
  band: { id: string; name: string; authority: string; profile: string };
  tour: string;
  shows: {
    show: string;
    city: string;
    venue: string;
    day: number;
    capacity: number;
    ticketsSold: number;
    state: string;
    date: number;
    thresholdDeadline: number;
    payees: { label: string; bps: number }[];
  }[];
  stats: { proposed: number; accepted: number; rejected: number; confirmed: number; cancelled: number; refunded: number; settled: number; ticketsSold: number; crewHired: number; messages: number; brain: string };
}

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNS_DIR = resolve(here, "../../../data/runs");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs the whole story end to end on one cluster:
 * setup -> (history tour) -> tour request -> offers -> plan -> propose/accept ->
 * fans buy -> crank confirms/cancels -> refunds -> crew hired -> settlement.
 */
export async function runDemo(opts: RunOptions): Promise<RunSummary> {
  const log = opts.log ?? ((l: string) => console.log(l));
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = opts.runDir ?? join(DEFAULT_RUNS_DIR, runId);
  mkdirSync(runDir, { recursive: true });
  const bus = new MessageBus({ file: join(runDir, "transcript.jsonl") });
  bus.on("*", (m) => log(`[${m.kind}] ${m.from}${m.to ? ` -> ${m.to}` : ""}: ${m.text}${m.tx ? ` (tx ${m.tx.slice(0, 8)}…)` : ""}`));

  const connection = new Connection(opts.rpcUrl, "confirmed");
  const client = GreenroomClient.fromKeypair(connection, opts.payer);
  const isLocal = /127\.0\.0\.1|localhost/.test(opts.rpcUrl);
  const brain = opts.brain ?? makeBrain();
  const countries = opts.countries ?? ["DE", "AT", "FR", "PL", "CZ"];
  const seed = opts.seed ?? "greenroom-2026";

  // Demo ticket prices: 0.01 SOL locally, 0.001 SOL on public clusters so a
  // faucet-sized balance covers the whole run (the hub pays for every fan).
  const basePriceLamports = isLocal ? 0.01 * LAMPORTS_PER_SOL : 0.001 * LAMPORTS_PER_SOL;
  const world: World = generateWorld({ seed, fansPerCity: opts.fansPerCity ?? 60, crewPerCity: opts.crewPerCity ?? 100, basePriceLamports });
  const band = opts.bandId ? world.bands.find((b) => b.id === opts.bandId) : world.bands[0];
  if (!band) throw new Error(`band ${opts.bandId} not found`);
  const bandKp = keypairFromSeedHex(band.seed);

  let venues: Venue[] = world.venues.filter((v) => countries.includes(v.country));
  if (opts.maxVenues) venues = venues.slice(0, opts.maxVenues);
  const venueKps = new Map(venues.map((v) => [v.id, keypairFromSeedHex(v.seed)]));

  // ---------- funding ----------
  const payerBal = await connection.getBalance(opts.payer.publicKey);
  if (isLocal && payerBal < 50 * LAMPORTS_PER_SOL) {
    try {
      await client.airdrop(opts.payer.publicKey, 500);
    } catch {
      /* some local validators have no working faucet; the mint wallet is rich anyway */
    }
  }
  const need = (await connection.getBalance(bandKp.publicKey)) < 0.5 * LAMPORTS_PER_SOL;
  if (need) await fund(client, opts.payer, bandKp.publicKey, isLocal ? 5 : 0.08);
  log(`payer ${opts.payer.publicKey.toBase58()} balance ${(await connection.getBalance(opts.payer.publicKey)) / LAMPORTS_PER_SOL} SOL`);

  // ---------- on-chain profiles ----------
  const bandProfile = bandPda(bandKp.publicKey, client.programId);
  if (!(await connection.getAccountInfo(bandProfile))) {
    const { sig } = await client.registerBand(bandKp, band.name, band.genre);
    bus.publish({ kind: "note", from: `band:${band.id}`, text: `${band.name} registered on-chain.`, tx: sig });
  }
  // Venues: find the unregistered ones in one RPC batch, fund them in a few
  // transactions, then register them with limited concurrency.
  const profiles = venues.map((v) => venuePda(venueKps.get(v.id)!.publicKey, client.programId));
  const infos = await getAccountsChunked(connection, profiles);
  const todo = venues.filter((_, i) => !infos[i]);
  const balances = await getAccountsChunked(connection, todo.map((v) => venueKps.get(v.id)!.publicKey));
  const toFund = todo.filter((_, i) => (balances[i]?.lamports ?? 0) < 0.0025 * LAMPORTS_PER_SOL);
  if (toFund.length) await client.transferSolMany(opts.payer, toFund.map((v) => ({ to: venueKps.get(v.id)!.publicKey, sol: isLocal ? 1 : 0.003 })));
  // Public RPCs rate-limit bursts (~10 req/s per IP), so off-localnet we go one
  // at a time with a small gap; locally we register 8 venues concurrently.
  const regConcurrency = isLocal ? 8 : 1;
  let registered = 0;
  for (let i = 0; i < todo.length; i += regConcurrency) {
    await Promise.all(
      todo.slice(i, i + regConcurrency).map(async (v) => {
        const kp = venueKps.get(v.id)!;
        try {
          await client.registerVenue(kp, v.name.slice(0, 32), v.city.slice(0, 32), v.lat, v.lng, v.capacity);
          registered++;
        } catch (e) {
          log(`venue ${v.id} registration failed: ${(e as Error).message.slice(0, 120)}`);
        }
      })
    );
    if (!isLocal) await sleep(300);
  }
  bus.publish({ kind: "note", from: "orchestrator", text: `${venues.length} venues online (${registered} newly registered) across ${countries.join("/")}.` });

  // ---------- agents ----------
  const venueAgents = venues.map((v) => new VenueAgent(v, venueKps.get(v.id)!, venuePda(venueKps.get(v.id)!.publicKey, client.programId), client, bus, brain));
  for (const a of venueAgents) a.start();
  const bandAgent = new BandAgent(band, bandKp, client, bus, brain, world.cities);
  const crank = new Crank(client, bus);
  const fans = new FanSim(band, world.fans, world.cities, client, bus, {
    maxBuysPerTick: opts.maxBuysPerTick ?? (isLocal ? 40 : 12),
    radiusKm: 80,
    seed,
    concurrency: isLocal ? 6 : 1,
    gapMs: isLocal ? 0 : 250,
  });
  const crewAddress = (c: CrewProfile) => keypairFromSeedHex(c.seed).publicKey.toBase58();

  const brief: TourBrief = {
    countries,
    wantedShows: opts.wantedShows ?? 8,
    windowDays: opts.windowDays ?? 21,
    thresholdBps: 5000,
    deadlineAfterSec: opts.deadlineAfterSec ?? 60,
    showAfterSec: opts.showAfterSec ?? 120,
    capacityScale: opts.capacityScale ?? 0.05,
    minCapacity: opts.minCapacity ?? 12,
    tourName: `${band.name} Central Europe`.slice(0, 32),
    region: "Central EU",
  };

  // ---------- optional history tour ----------
  if (opts.history) {
    const rec = await client.fetchBand(bandProfile);
    if (rec.showsCompleted === 0) {
      bus.publish({ kind: "note", from: "orchestrator", text: `Replaying last year's tour so ${band.name} has a real on-chain track record.` });
      await runTour(
        { ...brief, wantedShows: 3, deadlineAfterSec: 25, showAfterSec: 45, tourName: `${band.name} 2025`.slice(0, 32) },
        { hub: opts.payer.publicKey, connection, bandAgent, crank, fans, bus, client, world, crewAddress, log, tickMs: 1000, collectMs: 800, hireCrew: false }
      );
    }
  }

  // ---------- the tour ----------
  const outcome = await runTour(brief, { hub: opts.payer.publicKey, connection, bandAgent, crank, fans, bus, client, world, crewAddress, log, tickMs: opts.tickMs ?? 2500, collectMs: 1500, hireCrew: true });
  for (const a of venueAgents) a.stop();

  const summary: RunSummary = {
    runId,
    cluster: opts.rpcUrl,
    band: { id: band.id, name: band.name, authority: bandKp.publicKey.toBase58(), profile: bandProfile.toBase58() },
    tour: outcome.tour.toBase58(),
    shows: outcome.shows,
    stats: { ...outcome.stats, messages: bus.log.length, brain: brain.name },
  };
  writeFileSync(join(runDir, "summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(dirname(runDir), "latest.json"), JSON.stringify({ runId, dir: runDir }, null, 2));
  log(`run ${runId} finished: ${JSON.stringify(summary.stats)}`);
  return summary;
}

/** getMultipleAccountsInfo accepts at most 100 keys per call. */
async function getAccountsChunked(connection: Connection, keys: PublicKey[]) {
  const out: (Awaited<ReturnType<Connection["getMultipleAccountsInfo"]>>[number])[] = [];
  for (let i = 0; i < keys.length; i += 100) out.push(...(await connection.getMultipleAccountsInfo(keys.slice(i, i + 100))));
  return out;
}

async function fund(client: GreenroomClient, payer: Keypair, to: PublicKey, sol: number) {
  await client.transferSol(payer, to, sol);
}

interface TourDeps {
  /** Fee payer / hub wallet that pays for simulated fans. */
  hub: PublicKey;
  connection: Connection;
  bandAgent: BandAgent;
  crank: Crank;
  fans: FanSim;
  bus: MessageBus;
  client: GreenroomClient;
  world: World;
  crewAddress: (c: CrewProfile) => string;
  log: (l: string) => void;
  tickMs: number;
  collectMs: number;
  hireCrew: boolean;
}

async function runTour(brief: TourBrief, d: TourDeps) {
  const { bandAgent, crank, fans, bus, client, world } = d;
  const stats = { proposed: 0, accepted: 0, rejected: 0, confirmed: 0, cancelled: 0, refunded: 0, settled: 0, ticketsSold: 0, crewHired: 0 };

  const offers = await bandAgent.requestOffers(brief, d.collectMs);
  bus.publish({ kind: "note", from: bandAgent.id, text: `${offers.length} venues made offers.` });
  const plan = await bandAgent.plan(brief, offers);
  if (plan.length === 0) throw new Error("no viable plan (no offers?)");

  // Venue agents answer proposals on the bus as soon as they see them, so
  // listen before proposing anything.
  const decided = new Set<string>();
  const unsubscribeA = bus.on("show.accepted", (m) => {
    stats.accepted++;
    decided.add((m.data as { show: string }).show);
  });
  const unsubscribeR = bus.on("show.rejected", (m) => {
    stats.rejected++;
    decided.add((m.data as { show: string }).show);
  });

  const salesOpenAt = (await client.chainTime()) + 2;
  bandAgent.booked.length = 0;
  const { tour } = await bandAgent.book(brief, plan, salesOpenAt);
  stats.proposed = bandAgent.booked.length;

  for (let i = 0; i < 40 && decided.size < bandAgent.booked.length; i++) await sleep(500);
  unsubscribeA();
  unsubscribeR();

  // The chain is the source of truth: a show is live when its account exists
  // and is on sale (rejected shows are closed).
  const live: BookedShow[] = [];
  for (const b of bandAgent.booked) {
    try {
      const acct = await client.fetchShow(b.show);
      if (showStateName(acct.state) !== "proposed") live.push(b);
    } catch {
      /* closed by reject_show */
    }
  }
  bus.publish({ kind: "note", from: "orchestrator", text: `${live.length} of ${bandAgent.booked.length} proposed shows are on sale; fans are buying.` });
  const hiredFor = new Set<string>();
  const done = new Set<string>();

  // main loop: fans buy, crank advances state, crew gets hired, until every show is terminal.
  // Every RPC error inside a tick is transient by assumption (public endpoints
  // rate-limit bursts): log, back off, and try again next tick.
  const start = Date.now();
  let failures = 0;
  let hubEmptyNoted = false;
  while (done.size < live.length && Date.now() - start < (brief.showAfterSec + 180) * 1000) {
    let r: Awaited<ReturnType<Crank["run"]>>;
    try {
      const chainNow = await client.chainTime();
      const views: { booked: BookedShow; state: string; ticketsSold: number; capacity: number; progress: number }[] = [];
      const accounts = new Map<string, Awaited<ReturnType<GreenroomClient["fetchShow"]>>>();
      for (const b of live) {
        if (done.has(b.show.toBase58())) continue;
        let acct;
        try {
          acct = await client.fetchShow(b.show);
        } catch (e) {
          if (/does not exist|has no data/i.test((e as Error).message)) done.add(b.show.toBase58());
          continue;
        }
        accounts.set(b.show.toBase58(), acct);
        const state = showStateName(acct.state);
        if (state === "settled" || (state === "cancelled" && acct.ticketsRefunded === acct.ticketsSold)) done.add(b.show.toBase58());
        const openAt = Number(acct.thresholdDeadline) - brief.deadlineAfterSec;
        const progress = Math.min(1, Math.max(0, (chainNow - openAt) / Math.max(1, Number(acct.thresholdDeadline) - openAt)));
        views.push({ booked: b, state, ticketsSold: acct.ticketsSold, capacity: acct.capacity, progress });
      }
      // Fans buy only while the hub wallet (the fee payer) can still afford a
      // ticket plus account rent; otherwise say so once instead of failing per fan.
      const hubBalance = await d.connection.getBalance(d.hub);
      if (hubBalance > 0.01 * LAMPORTS_PER_SOL) {
        await fans.tick(views);
      } else if (!hubEmptyNoted) {
        hubEmptyNoted = true;
        bus.publish({ kind: "note", from: "orchestrator", text: `Hub wallet is down to ${(hubBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL; fans stop buying. Fund ${d.hub.toBase58()} to continue.` });
      }
      r = await crank.run(live.filter((b) => !done.has(b.show.toBase58())).map((b) => b.show), chainNow, accounts);
      failures = 0;
    } catch (e) {
      failures++;
      bus.publish({ kind: "note", from: "orchestrator", text: `RPC hiccup (${(e as Error).message.slice(0, 80)}); retrying in ${Math.min(10, 2 * failures)}s.` });
      await sleep(Math.min(10, 2 * failures) * 1000);
      continue;
    }
    stats.confirmed += r.confirmed.length;
    stats.cancelled += r.cancelled.length;
    stats.refunded += r.refunded;
    stats.settled += r.settled.length;

    if (d.hireCrew) {
      for (const show of r.confirmed) {
        const b = live.find((x) => x.show.equals(show));
        if (!b || hiredFor.has(show.toBase58())) continue;
        hiredFor.add(show.toBase58());
        const offers: CrewOffer[] = crewOffersFor(b, world.crew, d.crewAddress);
        for (const o of offers) {
          bus.publish({ kind: "crew.offer", from: `crew:${o.crewId}`, to: bandAgent.id, text: `${o.name}, ${o.role} in ${o.city} (${o.rating}★, ${o.yearsExperience} yrs): available for ${o.askBps / 100}% of the show.`, data: o });
        }
        const hired = await bandAgent.hireCrew(b, offers);
        stats.crewHired += hired.length;
      }
    }
    await sleep(d.tickMs);
  }

  const shows = [];
  for (const b of bandAgent.booked) {
    let state = "rejected";
    let ticketsSold = 0;
    let payees: { label: string; bps: number }[] = [];
    try {
      const acct = await client.fetchShow(b.show);
      state = showStateName(acct.state);
      ticketsSold = acct.ticketsSold;
      payees = acct.payees.map((p) => ({ label: p.label, bps: p.bps }));
    } catch {
      /* closed */
    }
    stats.ticketsSold += ticketsSold;
    shows.push({ show: b.show.toBase58(), city: b.city, venue: b.venueId, day: b.day, capacity: b.capacity, ticketsSold, state, date: b.date, thresholdDeadline: b.thresholdDeadline, payees });
  }
  return { tour, shows, stats };
}
