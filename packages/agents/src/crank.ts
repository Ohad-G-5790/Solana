import type { PublicKey } from "@solana/web3.js";
import { showStateName, type GreenroomClient, type ShowAccount } from "@greenroom/sdk";
import type { MessageBus } from "./bus.ts";

export interface CrankResult {
  confirmed: PublicKey[];
  cancelled: PublicKey[];
  refunded: number;
  settled: PublicKey[];
}

/**
 * Permissionless crank: anyone can run it. It only ever calls the three
 * time-gated instructions, so the worst a malicious cranker can do is make
 * things happen sooner.
 */
export class Crank {
  constructor(private readonly client: GreenroomClient, private readonly bus: MessageBus) {}

  async run(shows: PublicKey[], chainNow: number, prefetched?: Map<string, ShowAccount>): Promise<CrankResult> {
    const result: CrankResult = { confirmed: [], cancelled: [], refunded: 0, settled: [] };
    for (const show of shows) {
      let acct: ShowAccount | undefined = prefetched?.get(show.toBase58());
      if (!acct) {
        try {
          acct = await this.client.fetchShow(show);
        } catch {
          continue; // rejected shows are closed; transient RPC errors retry next tick
        }
      }
      const state = showStateName(acct.state);
      const sold = acct.ticketsSold;
      const required = Math.ceil((acct.capacity * acct.thresholdBps) / 10_000);

      if (state === "onSale") {
        const met = sold * 10_000 >= acct.capacity * acct.thresholdBps;
        const late = chainNow >= Number(acct.thresholdDeadline);
        if (met || late) {
          try {
            const tx = await this.client.checkThreshold(show);
            if (met) {
              result.confirmed.push(show);
              this.bus.publish({ kind: "crank.confirmed", from: "crank", text: `Threshold met (${sold}/${acct.capacity}, needed ${required}): show confirmed.`, tx, data: { show: show.toBase58(), ticketsSold: sold, capacity: acct.capacity } });
            } else {
              result.cancelled.push(show);
              this.bus.publish({ kind: "crank.cancelled", from: "crank", text: `Deadline passed with ${sold}/${acct.capacity} sold (needed ${required}): show cancelled, refunds start.`, tx, data: { show: show.toBase58(), ticketsSold: sold, required } });
            }
          } catch (e) {
            this.bus.publish({ kind: "note", from: "crank", text: `check_threshold failed: ${(e as Error).message.slice(0, 120)}` });
          }
        }
        continue;
      }

      if (state === "cancelled") {
        const tickets = await this.client.listTicketsByShow(show);
        for (const t of tickets) {
          if (t.account.refunded) continue;
          try {
            const tx = await this.client.refundTicket(show, t.account.buyer);
            result.refunded++;
            this.bus.publish({ kind: "crank.refunded", from: "crank", text: `Refunded ${Number(t.account.amountLamports)} lamports to ${t.account.buyer.toBase58().slice(0, 6)}…`, tx, data: { show: show.toBase58(), buyer: t.account.buyer.toBase58(), amountLamports: Number(t.account.amountLamports) } });
          } catch (e) {
            this.bus.publish({ kind: "note", from: "crank", text: `refund failed: ${(e as Error).message.slice(0, 120)}` });
          }
        }
        continue;
      }

      if (state === "confirmed" && chainNow >= Number(acct.date)) {
        try {
          const tx = await this.client.settleShow(show, acct);
          result.settled.push(show);
          const total = Number(acct.escrowLamports);
          this.bus.publish({
            kind: "crank.settled",
            from: "crank",
            text: `Show date passed: ${total} lamports split ${acct.bandBps / 100}% band / ${acct.venueBps / 100}% venue${acct.payees.length ? ` / ${acct.payees.map((p) => `${p.bps / 100}% ${p.label}`).join(", ")}` : ""}.`,
            tx,
            data: { show: show.toBase58(), total, bandBps: acct.bandBps, venueBps: acct.venueBps, payees: acct.payees.map((p) => ({ address: p.address.toBase58(), bps: p.bps, label: p.label })) },
          });
        } catch (e) {
          this.bus.publish({ kind: "note", from: "crank", text: `settle failed: ${(e as Error).message.slice(0, 120)}` });
        }
      }
    }
    return result;
  }
}
