"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DecisionCard } from "@/components/Approvals";
import { useBandSession } from "@/components/BandSession";
import { useBandTour } from "@/components/useBandTour";
import { pendingItems, type ApprovalsView } from "@/lib/approvals";
import { getApprovals, getRun, getWorld, type RunSummary, type WorldCity, type WorldVenue } from "@/lib/run";

export default function ApprovalsPage() {
  const session = useBandSession();
  const { tour: own } = useBandTour();
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
  // The questions belong to the band of the running (or recorded) tour.
  if (run && session.authority && run.band.authority !== session.authority) {
    const name = session.profile?.name ?? "your band";
    return (
      <div>
        <h1>Approvals</h1>
        <div className="card" style={{ marginTop: 16, maxWidth: 760 }}>
          <h3>No questions for {name} yet</h3>
          <p className="small muted" style={{ marginTop: 6 }}>
            When you create a tour, the route on the map is your decision: nothing is booked until you press Book. After that the tour runs by itself; a show
            that misses its target is cancelled and every fan is refunded automatically, so there is nothing to approve here.
          </p>
          <div className="row" style={{ marginTop: 14 }}>
            {own?.shows.length ? (
              <Link className="btn primary" href="/">
                Follow your tour
              </Link>
            ) : (
              <Link className="btn primary" href="/tour/new">
                Create a tour
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }
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
            <b>Auto-pilot is on for this tour:</b> the agent approved its own recommendations. Tours you create yourself start with your yes on the
            route.
          </p>
        </div>
      ) : null}
      {!view.writable && view.items.length ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <p className="small muted">
            This is a recorded tour, so you are looking at the decisions as they were made. On your own tours you make them.
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
