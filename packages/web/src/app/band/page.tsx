"use client";

import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { explorerUrl, POLL_MS } from "@/lib/config";
import { sol } from "@/lib/format";
import { bandPda, fetchBand, type BandAccount } from "@/lib/greenroom";
import { useBandSession } from "@/components/BandSession";
import { RegisterBand } from "@/components/Connect";
import { getRun, type RunSummary } from "@/lib/run";

export default function BandPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <BandView />
    </Suspense>
  );
}

function BandView() {
  const session = useBandSession();
  const authority = useSearchParams().get("authority") ?? session.authority;
  const [run, setRun] = useState<RunSummary | null>(null);
  const [band, setBand] = useState<BandAccount | null | undefined>(undefined);
  const [profile, setProfile] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await getRun();
        setRun(r);
        const auth = authority ?? r?.band.authority;
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
    const t = setInterval(load, Math.max(5000, POLL_MS));
    return () => clearInterval(t);
  }, [authority]);

  if (band === undefined) return <p className="muted">Loading…</p>;
  if (band === null && !error && session.wallet && authority === session.wallet) return <RegisterBand />;
  if (band === null)
    return (
      <div className="card">
        <h2>No band profile</h2>
        <p className="muted">{error ? `Could not reach the network (${error.slice(0, 80)}); retrying.` : "This wallet has no band yet. Connect it on the Dashboard to set one up."}</p>
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
          <div className="label">Shows played</div>
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
          <div className="label">Paid out in all</div>
          <div className="value">{sol(band.grossSettledLamports, 2)}</div>
        </div>
        <div className="stat">
          <div className="label">Tours</div>
          <div className="value">{band.toursCreated}</div>
        </div>
      </div>
      {band.showsCompleted === 0 ? (
        <div className="cta">
          <div>
            <h3>No played shows yet</h3>
            <p className="small muted">Every show that is played and paid out adds to this record, and venues read it before making an offer.</p>
          </div>
          {band.toursCreated === 0 ? (
            <Link href="/tour/new" className="btn primary big">
              Create your first tour
            </Link>
          ) : (
            <Link href="/" className="btn outline">
              Follow your tour
            </Link>
          )}
        </div>
      ) : null}
      <div className="card">
        <h3>Why this matters</h3>
        <p className="small muted" style={{ marginTop: 6 }}>
          These numbers only grow when a show is paid out, after it sold enough tickets and its date passed. Venue agents read
          them as proof of past concerts before making an offer; no screenshots, no promoter&apos;s word.
        </p>
        {run && run.band.authority === (authority ?? run.band.authority) ? (
          <p className="small" style={{ marginTop: 8 }}>
            Current tour: {run.shows.length} shows · {run.stats?.ticketsSold ?? "…"} tickets in this run.
          </p>
        ) : null}
      </div>
    </div>
  );
}
