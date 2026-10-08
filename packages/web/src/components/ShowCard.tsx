"use client";

import Link from "next/link";
import type { ShowAccount } from "@/lib/greenroom";
import { stateName } from "@/lib/greenroom";
import { demoDate, pct, sol, timeLeft } from "@/lib/format";
import type { RunShow } from "@/lib/run";

export function StateBadge({ state }: { state: string }) {
  const label = state === "onSale" ? "on sale" : state;
  return <span className={`badge ${state}`}>{label}</span>;
}

export function Progress({ sold, capacity, thresholdBps, state }: { sold: number; capacity: number; thresholdBps: number; state: string }) {
  return (
    <div className="progress" title={`${sold} of ${capacity} sold; threshold ${thresholdBps / 100}%`}>
      <div className={`fill ${state === "cancelled" ? "cancelled" : ""}`} style={{ width: `${pct(sold, capacity)}%` }} />
      <div className="threshold" style={{ left: `${thresholdBps / 100}%` }} />
    </div>
  );
}

export function ShowCard({ run, acct, now }: { run: RunShow; acct: ShowAccount | null | undefined; now: number }) {
  const state = acct ? stateName(acct.state) : run.state;
  const sold = acct ? acct.ticketsSold : run.ticketsSold;
  const capacity = acct ? acct.capacity : run.capacity;
  const thr = acct ? acct.thresholdBps : 5000;
  const required = Math.ceil((capacity * thr) / 10_000);
  const deadline = acct ? Number(acct.thresholdDeadline) : run.thresholdDeadline;
  const date = acct ? Number(acct.date) : run.date;
  return (
    <Link href={`/show?address=${run.show}`} className="card" style={{ display: "block" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3>{run.city}</h3>
        <StateBadge state={state} />
      </div>
      <p className="muted small">
        {run.venue.replace(/-/g, " ")} · day {run.day} · {demoDate(run.day)}
      </p>
      <Progress sold={sold} capacity={capacity} thresholdBps={thr} state={state} />
      <div className="row small" style={{ justifyContent: "space-between" }}>
        <span>
          <b>{sold}</b> / {capacity} sold · need {required}
        </span>
        <span className="muted">
          {acct ? sol(acct.escrowLamports) : ""}
        </span>
      </div>
      <div className="row micro muted" style={{ justifyContent: "space-between", marginTop: 6 }}>
        <span>{state === "onSale" ? `deadline ${timeLeft(deadline, now)}` : state === "confirmed" ? `settles ${timeLeft(date, now)}` : ""}</span>
        <span>{acct && acct.payees.length > 0 ? `crew: ${acct.payees.map((p) => p.label).join(", ")}` : ""}</span>
      </div>
    </Link>
  );
}
