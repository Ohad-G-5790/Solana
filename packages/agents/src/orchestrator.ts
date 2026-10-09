import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { GENRES, generateWorld, type Band, type CrewProfile, type Genre, type Venue, type World } from "@greenroom/world";
import { bandPda, GreenroomClient, keypairFromSeedHex, showStateName, venuePda } from "@greenroom/sdk";
import { findAlternatives } from "./alternatives.ts";
import type { AlternativeOption, ApprovalMode } from "./approvals.ts";
import { askBand, AutoApprover, FileApprover, type Approver } from "./approver.ts";
import { BandAgent, crewOffersFor, type BookedShow, type CrewOffer, type TourBrief } from "./band-agent.ts";
import { makeBrain, type Brain } from "./brain.ts";
import type { VenueOffer } from "./planner.ts";
import { MessageBus } from "./bus.ts";
import { Crank } from "./crank.ts";
import { FanSim } from "./fan-sim.ts";
import { VenueAgent } from "./venue-agent.ts";
import { formatSol } from "./sol.ts";

export interface RunOptions {
  rpcUrl: string;
  /** Fee payer + funder. On localnet it is airdropped; on devnet it must be funded already. */
  payer: Keypair;
  bandId?: string;
  /** Run as your own band: this wallet signs every band transaction (its profile is registered if missing). */
  bandKeypair?: Keypair;
  /** Who the band is (name, genre, typical draw, home city); defaults come from the generated band. */
  bandIdentity?: { name?: string; genre?: string; draw?: number; homeCity?: string };
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
  /** Shows in that past tour (default 3). */
  historyShows?: number;
  /** Only the past tour: build the band's on-chain record and stop (no current tour). */
  historyOnly?: boolean;
  brain?: Brain;
  runDir?: string;
  seed?: string;
  /** Fan purchases per tick (devnet: keep small). */
  maxBuysPerTick?: number;
  tickMs?: number;
  /**
   * Who approves venues, the route and replacement shows. "auto" (default):
   * auto-pilot takes the agent's recommendation. "dashboard": the run waits
   * for the band to decide in the dashboard (decisions.jsonl in the run folder).
   */
  approvals?: ApprovalMode;
  /** Seconds the band has to pick a replacement before the offer lapses (dashboard mode). */
  replacementTimeoutSec?: number;
  log?: (line: string) => void;
}

export interface RunShowSummary {
  show: string;
  city: string;
  venue: string;
  venueName?: string;
  day: number;
  capacity: number;
  ticketsSold: number;
  state: string;
  date: number;
  thresholdDeadline: number;
  salesOpenAt: number;
  ticketPriceLamports: number;
  venueBps: number;
  thresholdBps: number;
  payees: { label: string; bps: number }[];
  /** This show replaces a cancelled one. */
  replaces?: string;
  /** This cancelled show was replaced by another. */
  replacedBy?: string;
}

export interface TourStats {
  proposed: number;
  accepted: number;
  rejected: number;
  confirmed: number;
  cancelled: number;
  refunded: number;
  settled: number;
  ticketsSold: number;
  crewHired: number;
  replacements: number;
}

export interface RunSummary {
  runId: string;
  cluster: string;
  band: { id: string; name: string; authority: string; profile: string; homeCity: string; genre: string; draw: number };
  brief: { countries: string[]; wantedShows: number; windowDays: number };
  approvals: ApprovalMode;
  /** Empty when the band declined before anything was booked. */
  tour: string;
  shows: RunShowSummary[];
  stats: TourStats & { messages: number; brain: string };
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
  const basePriceLamports = isLocal ? 0.01 * LAMPORTS_PER_SOL : 0.005 * LAMPORTS_PER_SOL;
  const world: World = generateWorld({ seed, fansPerCity: opts.fansPerCity ?? 60, crewPerCity: opts.crewPerCity ?? 100, basePriceLamports });
  const base = opts.bandId ? world.bands.find((b) => b.id === opts.bandId) : world.bands[0];
  if (!base) throw new Error(`band ${opts.bandId} not found`);
  const band = withIdentity(base, opts.bandIdentity, world);
  const bandKp = opts.bandKeypair ?? keypairFromSeedHex(band.seed);

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
    if (rec.showsCompleted === 0 || opts.historyOnly) {
      bus.publish({ kind: "note", from: "orchestrator", text: `Replaying last year's tour so ${band.name} has a real on-chain track record.` });
      await runTour(
        // a local validator takes a purchase per tick; devnet about one per 2 s, so there the past tour sells as long as the main one
        {
          ...brief,
          wantedShows: opts.historyShows ?? 3,
          deadlineAfterSec: isLocal ? 25 : brief.deadlineAfterSec,
          showAfterSec: isLocal ? 45 : brief.showAfterSec,
          tourName: `${band.name} 2025`.slice(0, 32),
        },
        { hub: opts.payer.publicKey, connection, bandAgent, crank, fans, bus, client, world, crewAddress, log, tickMs: 1000, collectMs: 800, hireCrew: false }
      );
    }
  }

  // ---------- the tour ----------
  const mode: ApprovalMode = opts.approvals ?? "auto";
  const approver: Approver = mode === "dashboard" ? new FileApprover(join(runDir, "decisions.jsonl")) : new AutoApprover();
  if (mode === "dashboard") {
    bus.publish({ kind: "note", from: "orchestrator", text: "Approvals are on: the band agent waits for the band to approve venues, the route and any replacement show in the dashboard." });
    log(`[approvals] waiting for decisions in the dashboard (Approvals page); they are written to ${join(runDir, "decisions.jsonl")}`);
  }
  const outcome: TourOutcome = opts.historyOnly
    ? { tour: null, shows: [], stats: { proposed: 0, accepted: 0, rejected: 0, confirmed: 0, cancelled: 0, refunded: 0, settled: 0, ticketsSold: 0, crewHired: 0, replacements: 0 } }
    : await runTour(brief, {
    hub: opts.payer.publicKey,
    connection,
    bandAgent,
    crank,
    fans,
    bus,
    client,
    world,
    crewAddress,
    log,
    tickMs: opts.tickMs ?? 2500,
    collectMs: 1500,
    hireCrew: true,
    approver,
    replacementTimeoutSec: opts.replacementTimeoutSec ?? 300,
  });
  for (const a of venueAgents) a.stop();

  const summary: RunSummary = {
    runId,
    cluster: opts.rpcUrl,
    band: { id: band.id, name: band.name, authority: bandKp.publicKey.toBase58(), profile: bandProfile.toBase58(), homeCity: band.homeCity, genre: band.genre, draw: band.draw },
    brief: { countries: brief.countries, wantedShows: brief.wantedShows, windowDays: brief.windowDays },
    approvals: mode,
    tour: outcome.tour?.toBase58() ?? "",
    shows: outcome.shows,
    stats: { ...outcome.stats, messages: bus.log.length, brain: brain.name },
  };
  writeFileSync(join(runDir, "summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(dirname(runDir), "latest.json"), JSON.stringify({ runId, dir: runDir }, null, 2));
  log(`run ${runId} finished: ${JSON.stringify(summary.stats)}`);
  return summary;
}

/** A generated band with the caller's name, genre, draw and home city on top. */
export function withIdentity(base: Band, id: RunOptions["bandIdentity"], world: Pick<World, "cities">): Band {
  if (!id) return base;
  const name = (id.name ?? base.name).trim();
  if (!name || Buffer.byteLength(name) > 32) throw new Error(`band name must be 1-32 bytes: "${name}"`);
  const genre = (id.genre ?? base.genre) as Genre;
  if (!GENRES.includes(genre)) throw new Error(`genre must be one of ${GENRES.join(", ")}`);
  const draw = id.draw ?? base.draw;
  if (!Number.isFinite(draw) || draw < 20) throw new Error(`draw must be a number of people (got ${id.draw})`);
  const home = world.cities.find((c) => c.name.toLowerCase() === (id.homeCity ?? base.homeCity).toLowerCase());
  if (!home) throw new Error(`home city must be one of the dataset cities (got ${id.homeCity})`);
  const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return { ...base, id: slug || base.id, name, genre, draw: Math.round(draw), homeCity: home.name, country: home.country };
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

export interface TourDeps {
  /** Fee payer / hub wallet that pays for simulated fans. */
  hub: PublicKey;
  connection: Pick<Connection, "getBalance">;
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
  /** Without an approver nothing is asked (the history replay). */
  approver?: Approver;
  replacementTimeoutSec?: number;
}

export interface TourOutcome {
  tour: PublicKey | null;
  shows: RunShowSummary[];
  stats: TourStats;
}

/**
 * One tour, start to finish: offers -> (band approves venues) -> plan ->
 * (band approves the route) -> propose/accept -> fans buy -> crank confirms or
 * cancels -> (band picks a replacement for a cancelled show) -> refunds, crew,
 * settlement.
 */
export async function runTour(brief: TourBrief, d: TourDeps): Promise<TourOutcome> {
  const { bandAgent, crank, fans, bus, client, world, approver } = d;
  const stats: TourStats = { proposed: 0, accepted: 0, rejected: 0, confirmed: 0, cancelled: 0, refunded: 0, settled: 0, ticketsSold: 0, crewHired: 0, replacements: 0 };
  const nothingBooked = (why: string): TourOutcome => {
    bus.publish({ kind: "note", from: bandAgent.id, text: why });
    return { tour: null, shows: [], stats };
  };

  const offers = await bandAgent.requestOffers(brief, d.collectMs);
  bus.publish({ kind: "note", from: bandAgent.id, text: `${offers.length} venues made offers.` });
  if (offers.length === 0) throw new Error("no viable plan (no offers?)");

  // ---------- 1. the band approves venues ----------
  let approved: VenueOffer[] = offers;
  if (approver) {
    const req = bandAgent.venuesRequest(brief, offers);
    const p = req.payload.step === "venues" ? req.payload : null;
    const recommendedCount = req.recommended.step === "venues" ? req.recommended.venueIds.length : 0;
    const text = `${offers.length} venues in ${new Set(offers.map((o) => o.city)).size} cities made offers. I recommend ${recommendedCount}: the best ${brief.wantedShows} for the route plus backups for replacements. Approve the venues you want to play; nothing is booked yet.`;
    const decision = await askBand(bus, approver, bandAgent.id, req, text);
    const a = decision.answer;
    if (a.step !== "venues" || !a.approve || a.venueIds.length === 0) return nothingBooked(`No venues approved${p ? ` out of ${p.offers.length}` : ""}; the tour is not booked.`);
    approved = offers.filter((o) => a.venueIds.includes(o.venueId));
  }

  // ---------- 2. the band approves the route ----------
  let plan = await bandAgent.plan(brief, approved);
  if (plan.length === 0) {
    if (approver) return nothingBooked("The approved venues have no free days that fit the window; nothing booked.");
    throw new Error("no viable plan (no offers?)");
  }
  if (approver) {
    for (let round = 1; ; round++) {
      const { request, text } = bandAgent.routeRequest(plan, approved, round);
      const a = (await askBand(bus, approver, bandAgent.id, request, text)).answer;
      if (a.step === "route" && a.approve) break;
      if (a.step !== "route" || a.dropVenueIds.length === 0) return nothingBooked("Route declined; nothing booked.");
      if (round >= 5) return nothingBooked("Five routes declined; stopping here, nothing booked.");
      approved = approved.filter((o) => !a.dropVenueIds.includes(o.venueId));
      plan = await bandAgent.plan(brief, approved);
      if (plan.length === 0) return nothingBooked("No route is left after those changes; nothing booked.");
    }
  }

  // Venue agents answer proposals on the bus as soon as they see them, so
  // listen before proposing anything (replacements included).
  const decided = new Set<string>();
  const unsubscribeA = bus.on("show.accepted", (m) => {
    stats.accepted++;
    decided.add((m.data as { show: string }).show);
  });
  const unsubscribeR = bus.on("show.rejected", (m) => {
    stats.rejected++;
    decided.add((m.data as { show: string }).show);
  });

  // ---------- 3. book ----------
  const salesOpenAt = (await client.chainTime()) + 2;
  bandAgent.booked.length = 0;
  const { tour } = await bandAgent.book(brief, plan, salesOpenAt);
  stats.proposed = bandAgent.booked.length;

  for (let i = 0; i < 40 && decided.size < bandAgent.booked.length; i++) await sleep(500);

  // The chain is the source of truth: a show is live when its account exists
  // and is on sale (rejected shows are closed).
  // Only a missing account means "rejected"; any other error (rate limit,
  // timeout) is retried so a public RPC cannot silently empty the tour.
  const live: BookedShow[] = [];
  for (const b of bandAgent.booked) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const acct = await client.fetchShow(b.show);
        if (showStateName(acct.state) !== "proposed") live.push(b);
        break;
      } catch (e) {
        if (/does not exist|has no data/i.test((e as Error).message)) break;
        await sleep(2000 * (attempt + 1));
      }
    }
  }
  bus.publish({ kind: "note", from: "orchestrator", text: `${live.length} of ${bandAgent.booked.length} proposed shows are on sale; fans are buying.` });
  const hiredFor = new Set<string>();
  const done = new Set<string>();
  const cancelledShows = new Set<string>();
  const replacedBy = new Map<string, string>();

  // Replacement offers are asked without blocking the loop: other shows keep
  // selling while the band decides. Picks are booked at the top of a tick.
  const stopAsking = new AbortController();
  let asking = 0;
  const picked: { cancelled: BookedShow; optionId: string; options: AlternativeOption[] }[] = [];

  // main loop: fans buy, crank advances state, crew gets hired, until every show is terminal.
  // Every RPC error inside a tick is transient by assumption (public endpoints
  // rate-limit bursts): log, back off, and try again next tick.
  const start = Date.now();
  let limitMs = (brief.showAfterSec + 180) * 1000;
  let failures = 0;
  let hubEmptyNoted = false;
  while ((done.size < live.length || asking > 0 || picked.length > 0) && Date.now() - start < limitMs) {
    let r: Awaited<ReturnType<Crank["run"]>>;
    let chainNow: number;
    const accounts = new Map<string, Awaited<ReturnType<GreenroomClient["fetchShow"]>>>();
    try {
      chainNow = await client.chainTime();

      while (picked.length) {
        const { cancelled, optionId, options } = picked.shift()!;
        const option = options.find((o) => o.id === optionId);
        if (!option) continue;
        const booked = await bandAgent.bookReplacement(brief, tour, cancelled, option, chainNow + 2);
        if (!booked) continue;
        stats.proposed++;
        stats.replacements++;
        live.push(booked);
        replacedBy.set(cancelled.show.toBase58(), booked.show.toBase58());
        limitMs = Math.max(limitMs, Date.now() - start + (booked.date - chainNow + 180) * 1000);
      }

      const views: { booked: BookedShow; state: string; ticketsSold: number; capacity: number; progress: number }[] = [];
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
        const openAt = b.salesOpenAt;
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
        bus.publish({ kind: "note", from: "orchestrator", text: `Hub wallet is down to ${formatSol(hubBalance)}; fans stop buying. Fund ${d.hub.toBase58()} to continue.` });
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

    // ---------- 4. a show missed its threshold: offer the band a replacement ----------
    for (const show of r.cancelled) {
      const b = live.find((x) => x.show.equals(show));
      if (!b) continue;
      cancelledShows.add(b.show.toBase58());
      if (!approver) continue;
      if (b.replaces) {
        // One replacement per date: chasing a second one turns the tour into a ping-pong.
        bus.publish({ kind: "note", from: bandAgent.id, text: `The replacement in ${b.city} missed its threshold too; fans are refunded and the tour goes on without that date.` });
        continue;
      }
      const acct = accounts.get(b.show.toBase58());
      const sold = acct?.ticketsSold ?? 0;
      const required = Math.ceil((b.capacity * b.thresholdBps) / 10_000);
      const stillOn = live.filter((x) => !cancelledShows.has(x.show.toBase58()));
      const options = findAlternatives({
        band: bandAgent.band,
        cancelled: { venueId: b.venueId, city: b.city, day: b.day, capacity: b.capacity, ticketsSold: sold, thresholdBps: b.thresholdBps },
        offers: approved,
        route: stillOn.map((x) => {
          const o = approved.find((y) => y.venueId === x.venueId);
          return { venueId: x.venueId, city: x.city, day: x.day, lat: o?.lat ?? 0, lng: o?.lng ?? 0 };
        }),
        windowDays: brief.windowDays,
        capacityScale: brief.capacityScale,
        minCapacity: brief.minCapacity,
      });
      if (options.length === 0) {
        bus.publish({ kind: "note", from: bandAgent.id, text: `${b.city} was cancelled and none of the approved venues can take the date; fans are refunded and the tour goes on without it.` });
        continue;
      }
      const { request, text } = bandAgent.alternativeRequest(b, sold, required, options);
      const expiresAt = approver.mode === "dashboard" ? Date.now() + (d.replacementTimeoutSec ?? 300) * 1000 : undefined;
      asking++;
      void askBand(bus, approver, bandAgent.id, { ...request, expiresAt }, text, stopAsking.signal)
        .then((dec) => {
          const a = dec.answer;
          if (a.step === "alternative" && a.approve && a.optionId) picked.push({ cancelled: b, optionId: a.optionId, options });
        })
        .finally(() => asking--);
    }

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
  stopAsking.abort();
  unsubscribeA();
  unsubscribeR();

  const shows: RunShowSummary[] = [];
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
    shows.push({
      show: b.show.toBase58(),
      city: b.city,
      venue: b.venueId,
      venueName: b.venueName,
      day: b.day,
      capacity: b.capacity,
      ticketsSold,
      state,
      date: b.date,
      thresholdDeadline: b.thresholdDeadline,
      salesOpenAt: b.salesOpenAt,
      ticketPriceLamports: b.ticketPriceLamports,
      venueBps: b.venueBps,
      thresholdBps: b.thresholdBps,
      payees,
      replaces: b.replaces,
      replacedBy: replacedBy.get(b.show.toBase58()),
    });
  }
  return { tour, shows, stats };
}
