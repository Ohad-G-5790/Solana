"use client";

import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { routeTotals, legs, formatMinutes } from "@greenroom/world/geo";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useBandSession } from "@/components/BandSession";
import { RegisterBand } from "@/components/Connect";
import { DriveNote, Itinerary } from "@/components/Itinerary";
import { RouteMap } from "@/components/RouteMap";
import { DRAWS, LAMPORTS_PER_EURO, LENGTHS, PRICES, SALES_MINUTES, showsFor, type BookedTour, type TourAnswers, type TourPlan } from "@/lib/book";
import { explorerUrl } from "@/lib/config";
import { getWorld, type WorldCity, type WorldVenue } from "@/lib/run";

export default function NewTourPage() {
  const wallet = useAnchorWallet();
  const { profile, profileError } = useBandSession();
  const [world, setWorld] = useState<{ cities: WorldCity[]; venues: WorldVenue[] }>({ cities: [], venues: [] });
  const [a, setA] = useState<TourAnswers>({ draw: 500, priceEuro: 20, startCity: "Berlin", days: 14 });
  const [plan, setPlan] = useState<TourPlan | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<BookedTour | null>(null);

  useEffect(() => {
    void getWorld().then(setWorld);
  }, []);

  const cities = useMemo(() => [...world.cities].sort((x, y) => x.country.localeCompare(y.country) || x.name.localeCompare(y.name)), [world.cities]);
  const set = (patch: Partial<TourAnswers>) => {
    setA((cur) => ({ ...cur, ...patch }));
    setPlan(null);
    setError(null);
  };

  if (profile === null) return <RegisterBand />;
  if (!profile || !wallet) return <p className="muted">{profileError ? "Waiting for devnet…" : "Reading your band…"}</p>;

  const makePlan = async () => {
    setBusy("Asking the venues…");
    setError(null);
    try {
      const { planFromAnswers } = await import("@/lib/book");
      const p = await planFromAnswers(a, profile, world);
      setPlan(p);
      // the answer sits below the questions: bring it into view
      if (p.plan.length) setTimeout(() => document.getElementById("your-route")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      if (!p.plan.length) setError("No venue can take a band of this size on these dates. Try a different size or a longer tour.");
    } catch (e) {
      setError((e as Error).message.slice(0, 200));
    } finally {
      setBusy(null);
    }
  };

  const book = async () => {
    if (!plan) return;
    setError(null);
    try {
      const { bookTour } = await import("@/lib/book");
      setBooked(await bookTour(wallet, profile, plan, setBusy));
    } catch (e) {
      setError((e as Error).message.slice(0, 240));
    } finally {
      setBusy(null);
    }
  };

  if (booked) {
    return (
      <div className="card" style={{ maxWidth: 720 }}>
        <h1>Your tour is booked</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          {booked.shows.length} shows are proposed on-chain. Each venue&apos;s agent signs its show within about 10 minutes, then fans start buying. Sales close{" "}
          {SALES_MINUTES} minutes from now: a show that sells half its tickets by then is confirmed, the rest refund their fans automatically.
        </p>
        <div className="row" style={{ marginTop: 16 }}>
          <Link className="btn primary" href="/">
            Watch it on the dashboard
          </Link>
          <a className="small muted" href={explorerUrl("address", booked.tour)} target="_blank" rel="noreferrer">
            tour on explorer ↗
          </a>
        </div>
      </div>
    );
  }

  const stops = plan?.plan ?? [];
  const where = new Map(plan?.offers.map((o) => [o.venueId, o]) ?? []);
  const t = routeTotals(legs(stops.map((s) => where.get(s.venueId)!)));
  return (
    <div style={{ maxWidth: 980 }}>
      <h1>Create your tour</h1>
      <p className="muted" style={{ marginTop: 6 }}>
        Four answers. Your agent asks the venues, plans the route and shows it to you before anything is booked.
      </p>

      <section className="question">
        <h2>How many people can you bring?</h2>
        <p className="small muted">A typical night for {profile.name}. Venues offer rooms that fit.</p>
        <div className="choices">
          {DRAWS.map((d) => (
            <button key={d} className={`choice ${a.draw === d ? "on" : ""}`} onClick={() => set({ draw: d })} aria-pressed={a.draw === d}>
              {d.toLocaleString()}
            </button>
          ))}
        </div>
      </section>

      <section className="question">
        <h2>Ticket price</h2>
        <div className="choices">
          {PRICES.map((p) => (
            <button key={p} className={`choice ${a.priceEuro === p ? "on" : ""}`} onClick={() => set({ priceEuro: p })} aria-pressed={a.priceEuro === p}>
              €{p}
            </button>
          ))}
          <label className="small muted row" style={{ gap: 6 }}>
            or
            <input className="input" type="number" min={1} max={500} value={a.priceEuro} onChange={(e) => set({ priceEuro: Math.max(1, Math.min(500, Number(e.target.value) || 1)) })} aria-label="Ticket price in euros" />
          </label>
        </div>
      </section>

      <section className="question">
        <h2>Where does it start?</h2>
        <select className="select big" value={a.startCity} onChange={(e) => set({ startCity: e.target.value })} aria-label="First city">
          {cities.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.country})
            </option>
          ))}
        </select>
      </section>

      <section className="question">
        <h2>How long is the tour?</h2>
        <div className="choices">
          {LENGTHS.map((d) => (
            <button key={d} className={`choice ${a.days === d ? "on" : ""}`} onClick={() => set({ days: d })} aria-pressed={a.days === d}>
              {d} days
              <span className="micro muted">up to {showsFor(d)} shows</span>
            </button>
          ))}
        </div>
      </section>

      {!plan ? (
        <div className="row" style={{ marginTop: 20 }}>
          <button className="btn primary big" disabled={!!busy || !world.venues.length} onClick={makePlan}>
            {busy ?? "Plan my tour"}
          </button>
        </div>
      ) : null}
      {error ? <p className="small bad" style={{ marginTop: 12 }}>{error}</p> : null}

      {plan && stops.length ? (
        <section className="question" id="your-route">
          <h2>Your route</h2>
          <p className="small">
            {stops.length} shows in {stops[stops.length - 1].day - stops[0].day + 1} days · {t.km.toLocaleString()} km by road · longest drive {formatMinutes(t.longest?.minutes ?? 0)} ·{" "}
            {plan.offers.length} venues said yes, {plan.declined} said no.
          </p>
          {stops.length < showsFor(a.days) ? (
            <p className="micro muted">
              You asked for up to {showsFor(a.days)}. These are the ones that fit: a free room on the date, a short enough drive and a day off after long legs.
            </p>
          ) : null}
          <div className="split" style={{ marginTop: 12 }}>
            <RouteMap stops={stops.map((s) => ({ key: s.venueId, label: s.city, lat: where.get(s.venueId)!.lat, lng: where.get(s.venueId)!.lng }))} venues={world.venues} height={360} />
            <div>
              <Itinerary
                stops={stops.map((s) => ({
                  key: s.venueId,
                  day: s.day,
                  city: s.city,
                  venueName: s.venueName ?? s.venueId,
                  lat: where.get(s.venueId)!.lat,
                  lng: where.get(s.venueId)!.lng,
                  detail: `room ${where.get(s.venueId)!.capacity.toLocaleString()} · venue takes ${s.venueBps / 100}%`,
                }))}
              />
              <DriveNote />
            </div>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn primary big" disabled={!!busy} onClick={book}>
              {busy ?? "Book this tour"}
            </button>
            <button className="btn outline" disabled={!!busy} onClick={() => setPlan(null)}>
              Change answers
            </button>
          </div>
          <p className="micro muted" style={{ marginTop: 10, maxWidth: 720 }}>
            Your wallet asks you once and pays a small deposit to store the tour on Solana (about 0.005 SOL per show). On devnet each show sells a sample of the room, one ticket per 20 people,
            at €{a.priceEuro} = {(a.priceEuro * LAMPORTS_PER_EURO) / 1e9} SOL of play money, and sales run {SALES_MINUTES} minutes instead of months.
          </p>
        </section>
      ) : null}
    </div>
  );
}
