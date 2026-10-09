import { PublicKey } from "@solana/web3.js";
import { distanceKm, Rng, type Band, type City, type FanProfile } from "@greenroom/world";
import { keypairFromSeedHex, type GreenroomClient } from "@greenroom/sdk";
import type { MessageBus } from "./bus.ts";
import type { BookedShow } from "./band-agent.ts";

export interface FanSimOptions {
  /** Max purchases per tick across all shows (keeps devnet runs short). */
  maxBuysPerTick: number;
  /** Fans further than this from the venue city do not come. */
  radiusKm: number;
  seed: string;
  /** Parallel purchases per batch (public RPCs: keep at 1). */
  concurrency?: number;
  /** Pause between batches in ms. */
  gapMs?: number;
}

/**
 * Simulated fan population. Each fan is a deterministic wallet; a hub wallet
 * (the client's payer) pays for tickets on their behalf, and every ticket's
 * beneficiary is the fan, so refunds go to the fan.
 */
export class FanSim {
  private rng: Rng;
  private bought = new Set<string>(); // `${show}:${fanId}`
  private declined = new Set<string>();
  /** Fans who held a ticket per show: when a cancelled show is replaced they come back first. */
  private holders = new Map<string, Set<string>>();

  constructor(
    private readonly band: Band,
    private readonly fans: FanProfile[],
    private readonly cities: City[],
    private readonly client: GreenroomClient,
    private readonly bus: MessageBus,
    private readonly opts: FanSimOptions
  ) {
    this.rng = new Rng(`fans:${opts.seed}`);
  }

  fansNear(city: string): FanProfile[] {
    const c = this.cities.find((x) => x.name === city);
    if (!c) return this.fans.filter((f) => f.city === city);
    return this.fans.filter((f) => {
      if (f.city === city) return true;
      const fc = this.cities.find((x) => x.name === f.city);
      return fc ? distanceKm(fc, c) <= this.opts.radiusKm : false;
    });
  }

  /**
   * One simulation tick. `progress` is 0..1 of the way to the deadline; fans
   * with low eagerness wait, fans with high eagerness buy early.
   */
  async tick(shows: { booked: BookedShow; state: string; ticketsSold: number; capacity: number; progress: number }[]): Promise<number> {
    // 1. decide who buys this tick (deterministic), 2. send purchases in
    // parallel batches so a slow validator does not starve the deadline.
    const intents: { s: (typeof shows)[number]; fan: FanProfile; qty: number; key: string }[] = [];
    for (const s of shows) {
      if (s.state !== "onSale" && s.state !== "confirmed") continue;
      let planned = s.ticketsSold;
      const loyal = s.booked.replaces ? (this.holders.get(s.booked.replaces) ?? new Set<string>()) : new Set<string>();
      const candidates = this.fansNear(s.booked.city).sort((a, b) => Number(loyal.has(b.id)) - Number(loyal.has(a.id)));
      for (const fan of candidates) {
        if (intents.length >= this.opts.maxBuysPerTick) break;
        if (planned >= s.capacity) break;
        const key = `${s.booked.show.toBase58()}:${fan.id}`;
        if (this.bought.has(key) || this.declined.has(key)) continue;
        const taste = fan.taste[this.band.genre] ?? 0.05;
        if (fan.maxPriceLamports < s.booked.ticketPriceLamports) {
          this.declined.add(key);
          continue;
        }
        const urgency = 0.4 + 0.6 * s.progress; // fans hurry as the deadline nears
        // a fan refunded from the cancelled date mostly rebuys for its replacement
        const p = loyal.has(fan.id) ? 0.8 : taste * fan.eagerness * urgency * 0.9;
        if (this.rng.next() > p) continue;
        const qty = Math.min(this.rng.int(1, 2), s.capacity - planned);
        planned += qty;
        intents.push({ s, fan, qty, key });
      }
    }

    let buys = 0;
    const batch = this.opts.concurrency ?? 6;
    for (let i = 0; i < intents.length; i += batch) {
      if (i > 0 && this.opts.gapMs) await new Promise((r) => setTimeout(r, this.opts.gapMs));
      await Promise.all(
        intents.slice(i, i + batch).map(async ({ s, fan, qty, key }) => {
          const fanKey = keypairFromSeedHex(fan.seed).publicKey;
          try {
            let sig: string;
            try {
              ({ sig } = await this.client.buyTicket(null, s.booked.show, qty, fanKey));
            } catch (first) {
              // one retry for transient RPC/client hiccups; program errors rethrow immediately
              if (/SoldOut|InvalidState|SalesClosed|InvalidQuantity/.test((first as Error).message)) throw first;
              await new Promise((r) => setTimeout(r, 400));
              ({ sig } = await this.client.buyTicket(null, s.booked.show, qty, fanKey));
            }
            this.bought.add(key);
            const showKey = s.booked.show.toBase58();
            if (!this.holders.has(showKey)) this.holders.set(showKey, new Set());
            this.holders.get(showKey)!.add(fan.id);
            s.ticketsSold += qty;
            buys++;
            this.bus.publish({
              kind: "fan.bought",
              from: `fan:${fan.id}`,
              text: `${fan.name} (${fan.city}) bought ${qty} ticket${qty > 1 ? "s" : ""} for ${s.booked.city}.`,
              tx: sig,
              data: { show: s.booked.show.toBase58(), city: s.booked.city, fan: fanKey.toBase58(), quantity: qty, ticketsSold: s.ticketsSold, capacity: s.capacity },
            });
          } catch (e) {
            this.declined.add(key);
            const msg = (e as Error).message;
            if (!/SoldOut|InvalidState|SalesClosed/.test(msg)) {
              this.bus.publish({ kind: "note", from: `fan:${fan.id}`, text: `purchase failed: ${msg.slice(0, 120)}` });
            }
          }
        })
      );
    }
    return buys;
  }

  /** The fan wallet that would hold a ticket; used by the dashboard and the crank. */
  static fanAddress(fan: FanProfile): PublicKey {
    return keypairFromSeedHex(fan.seed).publicKey;
  }
}
