"use client";

import { PublicKey } from "@solana/web3.js";
import { use, useEffect, useState } from "react";
import { explorerUrl } from "@/lib/config";
import { sol } from "@/lib/format";
import { bandPda, fetchBand, type BandAccount } from "@/lib/greenroom";
import { getRun, type RunSummary } from "@/lib/run";

export default function BandPage({ params }: { params: Promise<{ authority?: string[] }> }) {
  const { authority } = use(params);
  const [run, setRun] = useState<RunSummary | null>(null);
  const [band, setBand] = useState<BandAccount | null | undefined>(undefined);
  const [profile, setProfile] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await getRun();
        setRun(r);
        const auth = authority?.[0] ?? r?.band.authority;
        if (!auth) {
          setBand(null);
          return;
        }
        const p = bandPda(new PublicKey(auth)).toBase58();
        setProfile(p);
        setBand(await fetchBand(p));
        setError(null);
      } catch (e) {
        setError((e as Error).message);
        setBand((b) => (b === undefined ? null : b));
      }
    };
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [authority]);

  if (band === undefined) return <p className="muted">Loading…</p>;
  if (band === null)
    return (
      <div className="card">
        <h2>No band profile</h2>
        <p className="muted">{error ? `RPC unreachable (${error.slice(0, 80)}). Is the validator running?` : "Run the demo first; the band registers itself on-chain."}</p>
      </div>
    );

  const avg = band.showsCompleted > 0 ? Math.round(Number(band.ticketsSoldTotal) / band.showsCompleted) : 0;
  return (
    <div>
      <h1>{band.name}</h1>
      <p className="muted">
        {band.genre} ·{" "}
        <a href={explorerUrl("address", profile)} target="_blank" rel="noreferrer">
          profile ↗
        </a>
      </p>
      <div className="stats">
        <div className="stat">
          <div className="label">Settled shows</div>
          <div className="value">{band.showsCompleted}</div>
        </div>
        <div className="stat">
          <div className="label">Tickets sold</div>
          <div className="value">{Number(band.ticketsSoldTotal)}</div>
        </div>
        <div className="stat">
          <div className="label">Avg per show</div>
          <div className="value">{avg}</div>
        </div>
        <div className="stat">
          <div className="label">Gross settled</div>
          <div className="value">{sol(band.grossSettledLamports, 2)}</div>
        </div>
        <div className="stat">
          <div className="label">Tours</div>
          <div className="value">{band.toursCreated}</div>
        </div>
      </div>
      <div className="card">
        <h3>Why this matters</h3>
        <p className="small muted" style={{ marginTop: 6 }}>
          These counters can only grow through <span className="mono">settle_show</span>, after a show reached its threshold and its date passed. Venue agents read
          them as proof of past concerts before making an offer; no screenshots, no promoter&apos;s word.
        </p>
        {run ? (
          <p className="small" style={{ marginTop: 8 }}>
            Current tour: {run.shows.length} shows · {run.stats?.ticketsSold ?? "…"} tickets in this run.
          </p>
        ) : null}
      </div>
    </div>
  );
}
