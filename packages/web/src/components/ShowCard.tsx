"use client";

import Link from "next/link";
import { dayLabel, pct, sol, timeLeft } from "@/lib/format";
import { HEALTH_LABEL, type Health, type ShowView } from "@/lib/health";

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

export function ShowCard({ v, now, venueName, replacedByCity }: { v: ShowView; now: number; venueName: string; replacedByCity?: string }) {
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
        <span>
          <b>{v.sold}</b> / {v.capacity} sold · need {v.required}
        </span>
        <span className="muted">{v.acct ? sol(v.escrowLamports) : ""}</span>
      </div>
      <p className={`micro ${v.health === "at-risk" ? "warn" : "muted"}`} style={{ marginTop: 6 }}>
        {v.status}
        {replacedByCity ? ` → ${replacedByCity}` : ""}
      </p>
      <div className="row micro muted" style={{ justifyContent: "space-between", marginTop: 4 }}>
        <span>{v.state === "onSale" ? `deadline ${timeLeft(v.deadline, now)}` : v.state === "confirmed" ? `show ${timeLeft(v.date, now)}` : ""}</span>
        <span>{run.payees.length > 0 || (v.acct && v.acct.payees.length > 0) ? `crew: ${(v.acct ? v.acct.payees.map((p) => p.label) : run.payees.map((p) => p.label)).join(", ")}` : ""}</span>
      </div>
    </Link>
  );
}
