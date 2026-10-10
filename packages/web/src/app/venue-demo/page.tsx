"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { VenueInbox } from "@/components/AgentTest";
import { SAMPLE_REQUESTS, venueDecides, type VenueRules } from "@/lib/agents";
import { CLUSTER, explorerUrl, FANS_PER_TICKET } from "@/lib/config";
import { fans, sol } from "@/lib/format";
import { getFeed, getRun, getWorld, type FeedMessage, type RunShow, type RunSummary, type WorldVenue } from "@/lib/run";

const NIGHTS = 28;
const COUNTRY: Record<string, string> = { DE: "Germany", AT: "Austria", FR: "France", PL: "Poland", CZ: "Czechia" };

/**
 * The venue's side of Greenroom: the demo venue is the one that played the
 * recorded tour's best-selling show. What happened on devnet comes from the
 * recording (offer, proposal, signature, sales, payout); the season's other
 * requests are sample bands answered by the same venue rules.
 */
export default function VenueDemoPage() {
  const [run, setRun] = useState<RunSummary | null | undefined>(undefined);
  const [venues, setVenues] = useState<WorldVenue[]>([]);
  const [feed, setFeed] = useState<FeedMessage[]>([]);

  useEffect(() => {
    void getRun().then(setRun);
    void getWorld().then((w) => setVenues(w.venues));
    void getFeed(0, 1000).then(setFeed);
  }, []);

  const show: RunShow | undefined = useMemo(
    () => run?.shows.filter((s) => s.state === "settled").sort((a, b) => b.ticketsSold - a.ticketsSold)[0] ?? run?.shows[0],
    [run]
  );
  const venue = venues.find((v) => v.id === show?.venue);

  if (run === undefined) return <p className="muted">Loading the demo venue…</p>;
  if (!run || !show) return <p className="muted">The demo venue needs the recorded tour, which this build does not have.</p>;

  const name = venue?.name ?? show.venueName ?? show.city;
  const rules: VenueRules = {
    city: show.city,
    capacity: venue?.capacity ?? 500,
    minPriceEuro: 20,
    sharePct: Math.round((show.venueBps ?? 3000) / 100),
    genres: venue?.genres ?? ["rock"],
  };
  const decisions = SAMPLE_REQUESTS.map((r) => ({ r, d: venueDecides(rules, r) }));
  const offers = decisions.filter((x) => x.d.offer);

  // the devnet show: what was sold and who got what
  const total = show.ticketsSold * (show.ticketPriceLamports ?? 0);
  const venueBps = show.venueBps ?? 3000;
  const payeeBps = show.payees.reduce((n, p) => n + p.bps, 0);
  const split = [
    { label: "Your venue", bps: venueBps, tone: "venue" },
    { label: run.band.name, bps: 10_000 - venueBps - payeeBps, tone: "band" },
    ...show.payees.map((p) => ({ label: p.label, bps: p.bps, tone: "crew" })),
  ];
  const story = feed.filter(
    (m) =>
      m.from === `venue:${show.venue}` ||
      (m.to === `venue:${show.venue}` && m.kind !== "tour.request") ||
      ((m.data as { show?: string } | undefined)?.show === show.show && m.kind.startsWith("crank."))
  );

  // the next four weeks: the devnet night plus the sample offers, one per free night
  const nights = new Map<number, string>([[show.day, run.band.name]]);
  let d = 3;
  for (const o of offers) {
    while (nights.has(d)) d++;
    if (d > NIGHTS) break;
    nights.set(d, o.r.band);
    d += 3;
  }

  return (
    <div className="venue-demo">
      <div className="demo-banner" role="region" aria-label="Live demo">
        <div className="demo-tags">
          <span className="live-badge">
            <i aria-hidden /> Live demo
          </span>
          <span className="net-badge">Solana {CLUSTER}</span>
        </div>
        <p>
          <b>You are exploring the demo venue, {name}.</b> How a venue sees Greenroom: band agents ask, your agent answers by your rules, the deal and the money run on
          Solana. No wallet needed.
        </p>
        <div className="demo-actions">
          <Link href="/agents/new?kind=venue" className="btn primary small">
            Create your venue agent
          </Link>
          <Link href="/home" className="btn outline small">
            Main page
          </Link>
        </div>
      </div>

      <header className="band-hero venue">
        <div className="band-avatar" aria-hidden>
          {name
            .split(/\s+/)
            .filter((w) => /^[A-Z0-9]/.test(w))
            .slice(0, 2)
            .map((w) => w[0])
            .join("")}
        </div>
        <div className="band-hero-text">
          <span className="eyebrow">Demo venue · {show.city}, {COUNTRY[venue?.country ?? ""] ?? venue?.country ?? ""}</span>
          <h1>{name}</h1>
          <p className="muted">
            {rules.capacity.toLocaleString()} capacity · books {rules.genres.join(", ")} · asks {rules.sharePct}% of the ticket money
          </p>
        </div>
      </header>

      <div className="stats">
        <Stat label="Band agents asked" value={String(SAMPLE_REQUESTS.length)} hint="sample requests this season (below)" />
        <Stat label="Nights offered" value={String(offers.length)} hint="by your agent's rules" />
        <Stat label="Booked on devnet" value={`${fans(show.ticketsSold)} fans`} hint={`of ${fans(show.capacity)} for the night signed on Solana`} />
        <Stat label="Paid to you" value={show.state === "settled" ? sol((total * venueBps) / 10_000, 3) : "after the show"} hint="devnet SOL, automatically at settlement" />
      </div>

      <h2 style={{ margin: "26px 0 10px" }}>Booked on Solana {CLUSTER}</h2>
      <div className="split-2">
        <div className="card">
          <span className="eyebrow">Day {show.day} · {show.state}</span>
          <h3 style={{ marginTop: 4 }}>{run.band.name}</h3>
          <p className="small muted">
            {fans(show.ticketsSold)} of {fans(show.capacity)} fans · ticket target {fans(Math.ceil((show.capacity * (show.thresholdBps ?? 5000)) / 10_000))} · one ticket on chain ({sol(show.ticketPriceLamports ?? 0, 4)}) stands for {FANS_PER_TICKET} fans
          </p>
          <div className="split-bar" role="img" aria-label="Who got the ticket money">
            {split.map((s) => (
              <span key={s.label} className={s.tone} style={{ width: `${s.bps / 100}%` }} title={`${s.label} ${s.bps / 100}%`} />
            ))}
          </div>
          <ul className="split-list small">
            {split.map((s) => (
              <li key={s.label}>
                <i className={s.tone} aria-hidden /> {s.label} <b>{(s.bps / 100).toFixed(2).replace(/\.00$/, "")}%</b>
                {show.state === "settled" ? <span className="muted"> · {sol((total * s.bps) / 10_000, 4)}</span> : null}
              </li>
            ))}
          </ul>
          <p className="micro muted" style={{ marginTop: 8 }}>
            Recorded before the 10% Greenroom fee; shows booked now carry it as one more payee, out of the band&apos;s share.{" "}
            <a href={explorerUrl("address", show.show)} target="_blank" rel="noreferrer">
              Show on Solana ↗
            </a>
          </p>
        </div>
        <div className="card">
          <span className="eyebrow">How it was agreed</span>
          <ol className="venue-story">
            {story.map((m) => (
              <li key={m.id}>
                <b>{m.from.startsWith("venue:") ? "Your agent" : m.from.startsWith("band:") ? `${run.band.name}'s agent` : m.from === "crank" ? "Solana" : m.from}</b>
                <span className="small">{m.text.replace(/(\d{6,}) lamports/g, (_, n) => sol(Number(n), 4))}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <h2 style={{ margin: "26px 0 10px" }}>Your agent&apos;s inbox</h2>
      <VenueInbox rules={rules} />

      <h2 style={{ margin: "26px 0 10px" }}>Your next four weeks</h2>
      <div className="nights" role="list" aria-label="Nights">
        {Array.from({ length: NIGHTS }, (_, k) => k + 1).map((i) => (
          <div key={i} role="listitem" className={`night ${nights.has(i) ? (i === show.day ? "chain" : "booked") : ""}`}>
            <span className="micro muted">Day {i}</span>
            {nights.has(i) ? <b className="small">{nights.get(i)}</b> : <span className="micro muted">free</span>}
          </div>
        ))}
      </div>
      <p className="micro muted" style={{ marginTop: 8 }}>
        Green: signed on {CLUSTER}. Grey: offered to a sample band, waiting for its route.
      </p>

      <div className="cta" style={{ marginTop: 26 }}>
        <div>
          <h3>Your venue, your rules</h3>
          <p className="small muted">Set your capacity, genres and terms in a few clicks; your agent answers every band agent the same minute.</p>
        </div>
        <Link href="/agents/new?kind=venue" className="btn primary big">
          Create your venue agent
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint ? <div className="micro muted">{hint}</div> : null}
    </div>
  );
}
