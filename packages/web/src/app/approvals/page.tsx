"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DecisionCard } from "@/components/Approvals";
import { pendingItems, type ApprovalsView } from "@/lib/approvals";
import { getApprovals, getRun, getWorld, type RunSummary, type WorldCity, type WorldVenue } from "@/lib/run";

export default function ApprovalsPage() {
  const [view, setView] = useState<ApprovalsView | null>(null);
  const [run, setRun] = useState<RunSummary | null>(null);
  const [world, setWorld] = useState<{ cities: WorldCity[]; venues: WorldVenue[] }>({ cities: [], venues: [] });

  const load = useCallback(async () => {
    const [a, r] = await Promise.all([getApprovals(), getRun()]);
    setView(a);
    setRun(r);
  }, []);

  useEffect(() => {
    void load();
    void getWorld().then(setWorld);
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  if (!view) return <p className="muted">Loading…</p>;
  const pending = pendingItems(view);
  // Waiting items first (oldest first), then the history, newest first.
  const decided = view.items.filter((i) => i.decision).reverse();
  const mode = run?.approvals ?? view.items[0]?.request.mode;
  const ctx = { writable: view.writable, sent: view.sent, venues: world.venues, cities: world.cities, onSent: () => void load() };

  return (
    <div>
      <h1>Approvals</h1>
      <p className="muted" style={{ margin: "6px 0 16px", maxWidth: 760 }}>
        The band agent negotiates, but you decide. It stops to ask which venues you are happy to play, whether the route works for you, and, if a show misses its
        threshold, which replacement to book. Nothing goes on-chain before you approve the route.
      </p>

      {mode === "auto" && view.writable ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <p className="small">
            <b>Auto-pilot is on for this run:</b> the agent approves its own recommendations. To decide yourself, start the agents with{" "}
            <span className="mono">npm run demo:approve</span> and keep this page open.
          </p>
        </div>
      ) : null}
      {!view.writable && view.items.length ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <p className="small muted">
            This is a recorded run, so you are looking at the decisions as they were made. Run <span className="mono">npm run demo:approve</span> locally to make them
            yourself.
          </p>
        </div>
      ) : null}

      {view.items.length === 0 ? (
        <div className="card">
          <h3>No questions yet</h3>
          <p className="small muted" style={{ marginTop: 6 }}>
            The first one comes once venues have answered the tour request. <Link href="/feed">Watch the agent feed →</Link>
          </p>
        </div>
      ) : null}

      {pending.length ? <h2 style={{ margin: "8px 0 10px" }}>Waiting for you ({pending.length})</h2> : view.items.length ? <p className="small good" style={{ marginBottom: 12 }}>All caught up: nothing is waiting for you.</p> : null}
      {pending.map((i) => (
        <DecisionCard key={i.request.id} item={i} ctx={ctx} />
      ))}

      {decided.length ? <h2 style={{ margin: "20px 0 10px" }}>Decided</h2> : null}
      {decided.map((i) => (
        <DecisionCard key={i.request.id} item={i} ctx={ctx} />
      ))}
    </div>
  );
}
