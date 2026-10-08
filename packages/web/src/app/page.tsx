"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Feed } from "@/components/Feed";
import { RouteMap } from "@/components/RouteMap";
import { ShowCard } from "@/components/ShowCard";
import { explorerUrl } from "@/lib/config";
import { chainTime, fetchShows, stateName, type ShowAccount } from "@/lib/greenroom";
import { sol } from "@/lib/format";
import { getRun, getWorld, type RunSummary, type WorldCity, type WorldVenue } from "@/lib/run";

export default function TourPage() {
  const [run, setRun] = useState<RunSummary | null | undefined>(undefined);
  const [accounts, setAccounts] = useState<Map<string, ShowAccount | null>>(new Map());
  const [world, setWorld] = useState<{ cities: WorldCity[]; venues: WorldVenue[] }>({ cities: [], venues: [] });
  const [now, setNow] = useState(0); // set from the chain clock on first poll
  const [rpcError, setRpcError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await getRun();
      if (!alive) return;
      setRun(r);
      if (r && r.shows.length) {
        try {
          const accts = await fetchShows(r.shows.map((s) => s.show));
          if (alive) {
            setAccounts(accts);
            setRpcError(null);
          }
        } catch (e) {
          if (alive) setRpcError((e as Error).message.slice(0, 120));
        }
      }
      try {
        setNow(await chainTime());
      } catch {
        setNow(Math.floor(Date.now() / 1000));
      }
    };
    void load();
    void getWorld().then((w) => alive && setWorld(w));
    const t = setInterval(load, 4000);
    const tick = setInterval(() => setNow((n) => n + 1), 1000);
    return () => {
      alive = false;
      clearInterval(t);
      clearInterval(tick);
    };
  }, []);

  if (run === undefined) return <p className="muted">Loading…</p>;
  if (!run) {
    return (
      <div className="card">
        <h2>No tour yet</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          Start the agents: <span className="mono">npm run demo:fast</span> (local validator) or <span className="mono">npm run demo:devnet</span>. The route, the
          negotiation and every transaction will show up here.
        </p>
      </div>
    );
  }

  const states = new Map<string, string>();
  let sold = 0;
  let escrow = 0;
  let confirmed = 0;
  let cancelled = 0;
  let settled = 0;
  for (const s of run.shows) {
    const a = accounts.get(s.show);
    const st = a ? stateName(a.state) : s.state;
    states.set(s.show, st);
    sold += a ? a.ticketsSold : s.ticketsSold;
    escrow += a ? Number(a.escrowLamports) : 0;
    if (st === "confirmed") confirmed++;
    if (st === "cancelled") cancelled++;
    if (st === "settled") settled++;
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1>{run.band.name}</h1>
          <p className="muted">
            Central Europe tour · {run.shows.length} shows ·{" "}
            {run.tour ? (
              <a href={explorerUrl("address", run.tour)} target="_blank" rel="noreferrer">
                tour on explorer ↗
              </a>
            ) : null}
            {run.partial ? " · run in progress" : ""}
          </p>
        </div>
        <Link href={`/band?authority=${run.band.authority}`} className="btn outline">
          Track record
        </Link>
      </div>

      {rpcError ? (
        <p className="small" style={{ color: "var(--warning)", marginTop: 8 }}>
          Live chain data unavailable ({rpcError}); showing the recorded run. Is the validator running and the RPC URL right?
        </p>
      ) : null}

      <div className="stats">
        <div className="stat">
          <div className="label">Tickets sold</div>
          <div className="value">{sold}</div>
        </div>
        <div className="stat">
          <div className="label">In escrow</div>
          <div className="value">{sol(escrow, 2)}</div>
        </div>
        <div className="stat">
          <div className="label">Confirmed</div>
          <div className="value">{confirmed + settled}</div>
        </div>
        <div className="stat">
          <div className="label">Cancelled</div>
          <div className="value">{cancelled}</div>
        </div>
        <div className="stat">
          <div className="label">Settled</div>
          <div className="value">{settled}</div>
        </div>
      </div>

      <RouteMap shows={run.shows} venues={world.venues} cities={world.cities} states={states} />

      <h2 style={{ margin: "20px 0 10px" }}>Shows</h2>
      <div className="grid">
        {[...run.shows]
          .sort((a, b) => a.day - b.day)
          .map((s) => (
            <ShowCard key={s.show} run={s} acct={accounts.get(s.show)} now={now} />
          ))}
      </div>

      <h2 style={{ margin: "24px 0 10px" }}>Agents, live</h2>
      <Feed limit={12} compact />
      <p className="small" style={{ marginTop: 8 }}>
        <Link href="/feed">Full feed →</Link>
      </p>
    </div>
  );
}
