/**
 * The network's keeper: what happens after a band books a tour from the
 * dashboard. Each run (a few minutes, on a schedule) it
 *   1. registers seed venues that are not on-chain yet,
 *   2. has each venue's agent sign the shows proposed to it,
 *   3. lets simulated fans near each city buy tickets,
 *   4. runs the permissionless crank: confirm, cancel, refund, settle.
 * The band never hands over a key: it signed its own proposals in the browser.
 */
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { generateWorld, type Band, type Venue } from "@greenroom/world";
import { GreenroomClient, keypairFromSeedHex, showStateName, venuePda, type ShowAccount } from "@greenroom/sdk";
import type { BookedShow } from "./band-agent.ts";
import { MessageBus } from "./bus.ts";
import { Crank } from "./crank.ts";
import { FanSim } from "./fan-sim.ts";

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
  log?: (line: string) => void;
  /** Tests inject an in-memory chain. */
  deps?: { client: GreenroomClient; connection: Pick<Connection, "getBalance" | "getMultipleAccountsInfo"> };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runKeeper(opts: KeeperOptions): Promise<{ accepted: number; ticketsBought: number; confirmed: number; cancelled: number; refunded: number; settled: number }> {
  const log = opts.log ?? ((l: string) => console.log(l));
  const connection = opts.deps?.connection ?? new Connection(opts.rpcUrl, "confirmed");
  const client = opts.deps?.client ?? GreenroomClient.fromKeypair(connection as Connection, opts.payer);
  // local validators and injected test chains need no rate-limit pacing
  const isLocal = /127\.0\.0\.1|localhost/.test(opts.rpcUrl) || !!opts.deps;
  const world = generateWorld({ seed: "greenroom-2026", bands: 1, crewPerCity: 1, fansPerCity: opts.fansPerCity ?? 10, basePriceLamports: isLocal ? 0.01 * LAMPORTS_PER_SOL : 0.001 * LAMPORTS_PER_SOL });
  const bus = new MessageBus();
  bus.on("*", (m) => log(`[${m.kind}] ${m.from}: ${m.text}${m.tx ? ` (tx ${m.tx.slice(0, 8)}…)` : ""}`));
  const stats = { accepted: 0, ticketsBought: 0, confirmed: 0, cancelled: 0, refunded: 0, settled: 0 };
  bus.on("fan.bought", () => stats.ticketsBought++);

  const byProfile = new Map<string, { venue: Venue; kp: Keypair }>();
  for (const v of world.venues) {
    const kp = keypairFromSeedHex(v.seed);
    byProfile.set(venuePda(kp.publicKey, client.programId).toBase58(), { venue: v, kp });
  }

  // 1. venues that are not on-chain yet
  const profiles = [...byProfile.keys()].map((k) => new PublicKey(k));
  const missing: { venue: Venue; kp: Keypair }[] = [];
  for (let i = 0; i < profiles.length; i += 100) {
    const infos = await connection.getMultipleAccountsInfo(profiles.slice(i, i + 100));
    infos.forEach((info, j) => {
      if (!info) missing.push(byProfile.get(profiles[i + j].toBase58())!);
    });
  }
  const toRegister = missing.slice(0, opts.registerVenues ?? 40);
  if (toRegister.length) {
    log(`registering ${toRegister.length} of ${missing.length} missing venues`);
    await client.transferSolMany(opts.payer, toRegister.map((m) => ({ to: m.kp.publicKey, sol: isLocal ? 1 : 0.003 })));
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
  while (Date.now() < end) {
    try {
      const now = await client.chainTime();
      const all = await client.program.account.show.all();
      const accounts = new Map<string, ShowAccount>(all.map((s) => [s.publicKey.toBase58(), s.account]));
      const work: PublicKey[] = [];
      const selling = new Map<string, Parameters<FanSim["tick"]>[0]>();
      for (const { publicKey, account: s } of all) {
        const state = showStateName(s.state);
        const venue = byProfile.get(s.venueProfile.toBase58());
        if (state === "proposed") {
          if (!venue || now >= Number(s.thresholdDeadline)) continue;
          try {
            const tx = await client.acceptShow(venue.kp, publicKey);
            stats.accepted++;
            bus.publish({ kind: "show.accepted", from: `venue:${venue.venue.id}`, text: `${venue.venue.name} signed the show (${s.capacity} tickets).`, tx, data: { show: publicKey.toBase58() } });
          } catch (e) {
            log(`accept ${publicKey.toBase58().slice(0, 8)}: ${(e as Error).message.slice(0, 100)}`);
          }
          continue;
        }
        if (state === "settled") continue;
        if (state === "cancelled" && s.ticketsRefunded >= s.ticketsSold) continue;
        if (state === "confirmed" && now < Number(s.date) && s.ticketsSold >= s.capacity) continue;
        work.push(publicKey);
        // fans buy while sales are open
        const open = (state === "onSale" && now < Number(s.thresholdDeadline)) || (state === "confirmed" && now < Number(s.date));
        if (open && venue) {
          const key = s.bandProfile.toBase58();
          const progress = Math.min(1, Math.max(0, 1 - (Number(s.thresholdDeadline) - now) / window));
          const booked = { show: publicKey, city: venue.venue.city, ticketPriceLamports: Number(s.ticketPriceLamports) } as unknown as BookedShow;
          selling.set(key, [...(selling.get(key) ?? []), { booked, state, ticketsSold: s.ticketsSold, capacity: s.capacity, progress }]);
        }
      }
      const balance = await connection.getBalance(opts.payer.publicKey);
      if (balance > 0.02 * LAMPORTS_PER_SOL) {
        for (const [bandProfile, views] of selling) {
          if (!bands.has(bandProfile)) {
            const b = await client.fetchBand(new PublicKey(bandProfile));
            bands.set(bandProfile, { ...world.bands[0], id: bandProfile, name: b.name, genre: b.genre as Band["genre"] });
          }
          if (!fanSims.has(bandProfile)) {
            fanSims.set(bandProfile, new FanSim(bands.get(bandProfile)!, world.fans, world.cities, client, bus, { maxBuysPerTick: isLocal ? 40 : 10, radiusKm: 80, seed: `keeper:${bandProfile}`, concurrency: isLocal ? 6 : 1, gapMs: isLocal ? 0 : 300 }));
          }
          await fanSims.get(bandProfile)!.tick(views);
        }
      } else {
        log(`payer balance ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL: fans paused, fund ${opts.payer.publicKey.toBase58()}`);
      }
      const r = await crank.run(work, now, accounts);
      stats.confirmed += r.confirmed.length;
      stats.cancelled += r.cancelled.length;
      stats.refunded += r.refunded;
      stats.settled += r.settled.length;
    } catch (e) {
      log(`tick failed (retrying): ${(e as Error).message.slice(0, 120)}`);
    }
    await sleep(opts.tickMs ?? (isLocal ? 2000 : 15_000));
  }
  return stats;
}
