"use client";

import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { explorerUrl, POLL_MS } from "@/lib/config";
import { fans, sol } from "@/lib/format";
import { reputation, reputationLabel, REPUTATION_SCALE } from "@/lib/reputation";
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
  // the demo band without an answer from devnet: its record as the recorded tour left it
  const recorded = band === null && run && (!authority || authority === run.band.authority) ? recordFromRun(run) : null;
  if (recorded) return <BandRecord band={recorded} profile={run!.band.profile} run={run} authority={authority} note="From the recorded tour; devnet is not answering right now." />;
  if (band === null)
    return (
      <div className="card">
        <h2>No band profile</h2>
        <p className="muted">{error ? `Could not reach the network (${error.slice(0, 80)}); retrying.` : "This wallet has no band yet. Connect it on the Dashboard to set one up."}</p>
      </div>
    );

  return <BandRecord band={band} profile={profile} run={run} authority={authority} />;
}

/** What the record page shows: the on-chain profile's numbers, or the recorded tour's. */
type BandNumbers = Pick<BandAccount, "name" | "genre" | "showsCompleted" | "toursCreated"> & {
  ticketsSoldTotal: { toString(): string } | number;
  grossSettledLamports: { toString(): string } | number;
};

function recordFromRun(run: RunSummary): BandNumbers {
  const played = run.shows.filter((s) => s.state === "settled");
  return {
    name: run.band.name,
    genre: run.band.genre ?? "",
    showsCompleted: played.length,
    toursCreated: 1,
    ticketsSoldTotal: played.reduce((n, s) => n + s.ticketsSold, 0),
    grossSettledLamports: played.reduce((n, s) => n + s.ticketsSold * (s.ticketPriceLamports ?? 0), 0),
  };
}

function BandRecord({ band, profile, run, authority, note }: { band: BandNumbers; profile: string; run: RunSummary | null; authority: string | null; note?: string }) {
  const avg = band.showsCompleted > 0 ? Math.round(Number(band.ticketsSoldTotal) / band.showsCompleted) : 0;
  const rep = reputation(band);
  return (
    <div>
      <h1>{band.name}</h1>
      {note ? <p className="small muted">{note}</p> : null}
      <p className="muted">
        {band.genre} ·{" "}
        <a href={explorerUrl("address", profile)} target="_blank" rel="noreferrer">
          profile ↗
        </a>
      </p>
      <div className="card reputation" aria-label="Reputation">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div className="label">Reputation</div>
            <div className="rep-score">
              {rep.toFixed(1)}
              <span className="muted"> / 10</span>
            </div>
            <div className="small muted">{reputationLabel(rep)}</div>
          </div>
          <p className="micro muted" style={{ maxWidth: 360 }}>
            From the record below only: fans per played show and the number of shows played. A stadium star with hundreds of shows is a 10.
          </p>
        </div>
        <div className="rep-bar" role="img" aria-label={`Reputation ${rep.toFixed(1)} out of 10`}>
          <div className="rep-fill" style={{ width: `${rep * 10}%` }} />
        </div>
        <div className="rep-scale micro muted">
          {REPUTATION_SCALE.map((s) => (
            <span key={s.at} style={{ left: `${s.at * 10}%` }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <div className="label">Shows played</div>
          <div className="value">{band.showsCompleted}</div>
        </div>
        <div className="stat">
          <div className="label">Fans in all</div>
          <div className="value">{fans(Number(band.ticketsSoldTotal))}</div>
        </div>
        <div className="stat">
          <div className="label">Fans per show</div>
          <div className="value">{fans(avg)}</div>
        </div>
        <div className="stat">
          <div className="label">Ticket money paid out</div>
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
