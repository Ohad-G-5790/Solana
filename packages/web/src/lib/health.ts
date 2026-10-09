import { fans } from "./format";
import type { ShowAccount } from "./greenroom";
import { stateName } from "./greenroom";
import type { RunShow } from "./run";

export type Health = "proposed" | "on-track" | "at-risk" | "confirmed" | "cancelled" | "settled" | "rejected";

export interface ShowView {
  run: RunShow;
  acct: ShowAccount | null | undefined;
  state: string;
  sold: number;
  capacity: number;
  thresholdBps: number;
  required: number;
  deadline: number;
  date: number;
  priceLamports: number;
  /** Band share in bps after venue and crew. */
  bandBps: number;
  escrowLamports: number;
  health: Health;
  /** One line for the band: what is going on with this show. */
  status: string;
}

/**
 * Merge the recorded show with live chain state and judge how it is doing.
 * "At risk" means on sale and behind the pace needed to reach the threshold by
 * the deadline (only for runs that record when sales opened).
 */
export function showView(run: RunShow, acct: ShowAccount | null | undefined, now: number, inFans = false): ShowView {
  // a band's own devnet tour speaks in fans (1 ticket = FANS_PER_TICKET); recordings in tickets
  const u = (n: number) => (inFans ? `${fans(n)} fans` : String(n));
  const more = (n: number) => (inFans ? `${fans(n)} more fans` : `${n} more`);
  const state = acct ? stateName(acct.state) : run.state;
  const sold = acct ? acct.ticketsSold : run.ticketsSold;
  const capacity = acct ? acct.capacity : run.capacity;
  const thresholdBps = acct ? acct.thresholdBps : (run.thresholdBps ?? 5000);
  const required = Math.ceil((capacity * thresholdBps) / 10_000);
  const deadline = acct ? Number(acct.thresholdDeadline) : run.thresholdDeadline;
  const date = acct ? Number(acct.date) : run.date;
  const priceLamports = acct ? Number(acct.ticketPriceLamports) : (run.ticketPriceLamports ?? 0);
  const payeeBps = run.payees.reduce((s, p) => s + p.bps, 0);
  const bandBps = acct ? acct.bandBps : 10_000 - (run.venueBps ?? 3000) - payeeBps;
  const escrowLamports = acct ? Number(acct.escrowLamports) : 0;

  let health: Health;
  let status: string;
  if (state === "proposed") {
    health = "proposed";
    status = "Waiting for the venue to sign";
  } else if (state === "rejected") {
    health = "rejected";
    status = "The venue declined";
  } else if (state === "cancelled") {
    health = "cancelled";
    status = `Missed its target of ${u(required)}; ${run.replacedBy ? "replaced, " : ""}fans refunded`;
  } else if (state === "settled") {
    health = "settled";
    status = "Played and paid out";
  } else if (state === "confirmed") {
    health = "confirmed";
    status = sold >= capacity ? "Sold out" : `Goes ahead with ${u(sold)}; still selling`;
  } else {
    const opened = run.salesOpenAt;
    const window = opened ? deadline - opened : 0;
    const elapsed = opened && now ? Math.min(1, Math.max(0, (now - opened) / Math.max(1, window))) : 0;
    const behind = opened !== undefined && elapsed >= 0.3 && sold < required * elapsed * 0.8;
    health = behind ? "at-risk" : "on-track";
    const need = Math.max(0, required - sold);
    status =
      need === 0
        ? "Target reached; it goes ahead at the next check"
        : behind
          ? `Behind pace: ${more(need)} needed, ${Math.round((1 - elapsed) * 100)}% of the selling time left`
          : `${more(need)} and it goes ahead`;
  }
  return { run, acct, state, sold, capacity, thresholdBps, required, deadline, date, priceLamports, bandBps, escrowLamports, health, status };
}

/** The band's share of ticket money for a show that is happening (confirmed or settled). */
export function bandTake(v: ShowView): number {
  if (v.state !== "confirmed" && v.state !== "settled") return 0;
  return Math.floor((v.sold * v.priceLamports * v.bandBps) / 10_000);
}

export const HEALTH_LABEL: Record<Health, string> = {
  proposed: "waiting for venue",
  "on-track": "on sale",
  "at-risk": "at risk",
  confirmed: "confirmed",
  cancelled: "cancelled",
  settled: "settled",
  rejected: "declined",
};
