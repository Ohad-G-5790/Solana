"use client";

import Link from "next/link";
import { dayLabel, euros, fans, pct, sol, timeLeft } from "@/lib/format";
import { HEALTH_LABEL, type Health, type ShowView } from "@/lib/health";

/** "sales close in 29m", or "sales closed" once the time has passed. */
function until(what: string, unix: number, now: number): string {
  const t = timeLeft(unix, now);
  return t === "passed" ? (what === "show" ? "show time passed" : "sales closed") : `${what} in ${t}`;
}

export function StateBadge({ state }: { state: string }) {
  const label = state === "onSale" ? "on sale" : state;
  return <span className={`badge ${state}`}>{label}</span>;
}

export function HealthBadge({ health }: { health: Health }) {
  const cls = health === "on-track" ? "onSale" : health;
  return <span className={`badge ${cls}`}>{HEALTH_LABEL[health]}</span>;
}

export function Progress({ sold, capacity, thresholdBps, state }: { sold: number; capacity: number; thresholdBps: number; state: string }) {
  return (
    <div className="progress" title={`${sold} of ${capacity} sold; threshold ${thresholdBps / 100}%`}>
      <div className={`fill ${state === "cancelled" ? "cancelled" : ""}`} style={{ width: `${pct(sold, capacity)}%` }} />
      <div className="threshold" style={{ left: `${thresholdBps / 100}%` }} />
    </div>
  );
}

/** bandUnits: a band's own devnet tour, shown in fans and euros instead of sample tickets and SOL. */
export function ShowCard({ v, now, venueName, replacedByCity, bandUnits }: { v: ShowView; now: number; venueName: string; replacedByCity?: string; bandUnits?: boolean }) {
  const { run } = v;
  return (
    <Link href={`/show?address=${run.show}`} className="card" style={{ display: "block" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3>{run.city}</h3>
        <HealthBadge health={v.health} />
      </div>
      <p className="muted small">
        {venueName} · {dayLabel(run.day)}
      </p>
      {run.replaces ? <p className="micro good" style={{ marginTop: 4 }}>Replacement show</p> : null}
      <Progress sold={v.sold} capacity={v.capacity} thresholdBps={v.thresholdBps} state={v.state} />
      <div className="row small" style={{ justifyContent: "space-between" }}>
        {bandUnits ? (
          <span>
            <b>{fans(v.sold)}</b> of {fans(v.capacity)} fans · goes ahead at {fans(v.required)}
          </span>
        ) : (
          <span>
            <b>{v.sold}</b> / {v.capacity} sold · need {v.required}
          </span>
        )}
        <span className="muted">{v.acct ? (bandUnits ? euros(v.escrowLamports) : sol(v.escrowLamports)) : ""}</span>
      </div>
      <p className={`micro ${v.health === "at-risk" ? "warn" : "muted"}`} style={{ marginTop: 6 }}>
        {bandUnits && v.state === "onSale" ? `${fans(Math.max(0, v.required - v.sold))} more fans and it goes ahead` : v.status}
        {replacedByCity ? ` → ${replacedByCity}` : ""}
      </p>
      <div className="row micro muted" style={{ justifyContent: "space-between", marginTop: 4 }}>
        <span>{v.state === "onSale" ? until("sales close", v.deadline, now) : v.state === "confirmed" ? until("show", v.date, now) : ""}</span>
        <span>{run.payees.length > 0 || (v.acct && v.acct.payees.length > 0) ? `crew: ${(v.acct ? v.acct.payees.map((p) => p.label) : run.payees.map((p) => p.label)).join(", ")}` : ""}</span>
      </div>
    </Link>
  );
}
