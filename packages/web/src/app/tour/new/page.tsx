"use client";

import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { routeTotals, legs, formatMinutes } from "@greenroom/world/geo";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useBandSession } from "@/components/BandSession";
import { useBandTour } from "@/components/useBandTour";
import { RegisterBand } from "@/components/Connect";
import { WalletButton } from "@/components/WalletButton";
import { DriveNote, Itinerary } from "@/components/Itinerary";
import { RouteMap } from "@/components/RouteMap";
import { DRAWS, LAMPORTS_PER_EURO, LENGTHS, planMoney, PRICES, replan, SALES_MINUTES, showsFor, type BookedTour, type TourAnswers, type TourPlan } from "@/lib/book";
import { explorerUrl, FANS_PER_TICKET } from "@/lib/config";
import { getRun, getWorld, type WorldCity, type WorldVenue } from "@/lib/run";
import type { BandAccount } from "@/lib/greenroom";
import { latestBandAgent } from "@/lib/agents";

export default function NewTourPage() {
  const wallet = useAnchorWallet();
  const { profile, profileError, guest } = useBandSession();
  // The demo band plans with the very same planner; only booking needs your own wallet.
  const demo = !wallet && guest;
  const [demoBand, setDemoBand] = useState<DemoBand | null>(null);
  const [world, setWorld] = useState<{ cities: WorldCity[]; venues: WorldVenue[] }>({ cities: [], venues: [] });
  const [a, setA] = useState<TourAnswers>({ draw: 500, priceEuro: 20, startCity: "Berlin", days: 14, roundTrip: true });
  const [plan, setPlan] = useState<TourPlan | null>(null);
  const [priceText, setPriceText] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Where the error belongs: under the questions (planning) or under the Book button (booking). */
  const [errorAt, setErrorAt] = useState<"plan" | "book">("plan");
  const [booked, setBooked] = useState<BookedTour | null>(null);
  const { tour: current } = useBandTour();
  const running = !!current?.shows.some((s) => s.state === "proposed" || s.state === "onSale" || s.state === "confirmed");
  /** A booking that stopped part-way: the tour exists, some shows are missing. */
  const [partial, setPartial] = useState<{ tourId: number; message: string } | null>(null);

  useEffect(() => {
    void getWorld().then(setWorld);
  }, []);

  // the demo band's own numbers: its on-chain profile, or what the recorded tour says
  useEffect(() => {
    if (!demo) return;
    let alive = true;
    void getRun().then(async (r) => {
      if (!r || !alive) return;
      const played = r.shows.filter((x) => x.state === "settled");
      const recorded: DemoBand = {
        name: r.band.name,
        genre: r.band.genre ?? "rock",
        showsCompleted: played.length,
        ticketsSoldTotal: played.reduce((n, x) => n + x.ticketsSold, 0),
      };
      try {
        const { fetchBand } = await import("@/lib/greenroom");
        const onChain = r.band.profile ? await fetchBand(r.band.profile) : null;
        if (alive) setDemoBand(onChain ? { name: onChain.name, genre: onChain.genre, showsCompleted: onChain.showsCompleted, ticketsSoldTotal: Number(onChain.ticketsSoldTotal) } : recorded);
      } catch {
        if (alive) setDemoBand(recorded);
      }
    });
    return () => {
      alive = false;
    };
  }, [demo]);

  // an unfinished booking survives a reload: same answers, Finish booking adds the missing shows
  const key = wallet ? `greenroom.partial.${wallet.publicKey.toBase58()}` : null;
  useEffect(() => {
    if (!key) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(key) ?? "null") as { tourId: number; message: string; answers: TourAnswers } | null;
      if (saved) {
        setPartial({ tourId: saved.tourId, message: saved.message });
        setA(saved.answers);
      } else {
        // a band agent made on the Agents page: its rules are the first answers
        const agent = latestBandAgent()?.band;
        if (agent) setA((cur) => ({ ...cur, draw: agent.draw, priceEuro: agent.priceEuro, startCity: agent.homeCity, roundTrip: agent.roundTrip }));
      }
    } catch {
      /* storage blocked: the banner lasts for this page view */
    }
  }, [key]);
  const remember = (p: { tourId: number; message: string } | null) => {
    setPartial(p);
    try {
      if (key && p) window.localStorage.setItem(key, JSON.stringify({ ...p, answers: a }));
      else if (key) window.localStorage.removeItem(key);
    } catch {
      /* in-memory only */
    }
  };

  const cities = useMemo(() => [...world.cities].sort((x, y) => x.country.localeCompare(y.country) || x.name.localeCompare(y.name)), [world.cities]);
  const set = (patch: Partial<TourAnswers>) => {
    // other answers are another tour: the unfinished one is left as it is
    if (partial) remember(null);
    setA((cur) => ({ ...cur, ...patch }));
    setPlan(null);
    setError(null);
  };

  if (!demo && profile === null) return <RegisterBand />;
  const band: DemoBand | null = demo ? demoBand : profile ? { name: profile.name, genre: profile.genre, showsCompleted: profile.showsCompleted, ticketsSoldTotal: Number(profile.ticketsSoldTotal) } : null;
  if (!band || (!demo && (!profile || !wallet)))
    return (
      <p className="muted">
        {profileError ? "Devnet is busy, so your band takes a moment to load. This page keeps trying by itself." : demo ? "Reading the demo band…" : "Reading your band…"}
      </p>
    );

  const makePlan = async () => {
    setErrorAt("plan");
    setBusy("Asking the venues…");
    setError(null);
    try {
      const { planFromAnswers } = await import("@/lib/book");
      const p = await planFromAnswers(a, band, world);
      setPlan(p);
      // the answer sits below the questions: bring it into view
      if (p.plan.length) setTimeout(() => document.getElementById("your-route")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      if (!p.plan.length) setError((await import("@/lib/book")).emptyPlanReason(p));
    } catch (e) {
      setError((await import("@/lib/book")).bookingErrorText(e));
    } finally {
      setBusy(null);
    }
  };

  const book = async () => {
    if (!plan || busy || !wallet || !profile) return;
    setError(null);
    setErrorAt("book");
    setBusy("Preparing your booking…"); // disables the button at once: no double booking
    const { bookTour, bookingErrorText, PartialBooking } = await import("@/lib/book");
    try {
      setBooked(await bookTour(wallet, profile, plan, setBusy, partial ? { tourId: partial.tourId } : undefined));
      remember(null);
    } catch (e) {
      if (e instanceof PartialBooking) remember({ tourId: e.tourId, message: e.message });
      else {
        setErrorAt("book");
        setError(bookingErrorText(e));
      }
      // the answer sits right under the Book button: bring it into view
      setTimeout(() => document.getElementById("book-status")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    } finally {
      setBusy(null);
    }
  };

  if (booked) {
    return (
      <div className="card" style={{ maxWidth: 720 }}>
        <h1>Your tour is booked</h1>
        {booked.restarted ? (
          <p className="small warn" style={{ marginTop: 8 }}>
            Your unfinished booking was too old (or a different route) to complete, so this is a new tour. The shows that did go through earlier still run on their own.
          </p>
        ) : null}
        <p className="muted" style={{ marginTop: 8 }}>
          {booked.shows.length} shows are booked. Each venue signs its show within about 10 minutes, then fans start buying. Ticket sales run for about{" "}
          {SALES_MINUTES} minutes: a show that sells half its tickets by then goes ahead; the others are cancelled and their fans refunded automatically.
        </p>
        <div className="row" style={{ marginTop: 16 }}>
          <Link className="btn primary" href="/">
            Watch it on the dashboard
          </Link>
          <a className="small muted" href={booked.signatures[0] ? explorerUrl("tx", booked.signatures[0]) : explorerUrl("address", booked.tour)} target="_blank" rel="noreferrer">
            booking receipt on Solana ↗
          </a>
        </div>
      </div>
    );
  }

  const stops = plan?.plan ?? [];
  const where = new Map(plan?.offers.map((o) => [o.venueId, o]) ?? []);
  const t = routeTotals(legs(stops.map((s) => where.get(s.venueId)!)));
  const reorder = (ids: string[]) => plan && setPlan(replan(plan, ids));
  const move = (i: number, by: number) => {
    const ids = stops.map((s) => s.venueId);
    [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
    reorder(ids);
  };
  const drop = (i: number) => reorder(stops.map((s) => s.venueId).filter((_, j) => j !== i));
  const reset = () => plan && reorder(plan.suggested);
  return (
    <div style={{ maxWidth: 980 }}>
      <h1>{demo ? `Plan a tour for ${band.name}` : "Create your tour"}</h1>
      <p className="muted" style={{ marginTop: 6 }}>
        Four answers. {demo ? "The band's" : "Your"} agent asks the venues, plans the route and shows it {demo ? "here" : "to you"} before anything is booked.
      </p>
      {demo ? (
        <p className="small muted" style={{ marginTop: 10 }}>
          This is the same planner a band uses with its own wallet: real venues answer with the demo band&apos;s track record. Booking needs your own wallet.
        </p>
      ) : null}
      {running && !demo ? (
        <p className="small muted" style={{ marginTop: 10 }}>
          Your current tour still has shows selling. You can book another one; the dashboard then follows the new tour, and the current shows carry on by
          themselves.
        </p>
      ) : null}
      {partial && !plan ? (
        <p className="small warn" style={{ marginTop: 10 }}>
          Your last booking stopped part-way. Your answers are back: press Plan my tour, then Finish booking to add the missing shows to the same tour.{" "}
          <button className="link-btn small" onClick={() => remember(null)}>
            Start over instead
          </button>
        </p>
      ) : null}

      <section className="question">
        <h2>How many people can you bring?</h2>
        <p className="small muted">A typical night for {band.name}. Venues offer rooms that fit.</p>
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
            <input
              className="input"
              type="number"
              min={1}
              max={200}
              value={priceText ?? a.priceEuro}
              // keep what is typed; take it once it is a valid price, tidy up on leaving the box
              onChange={(e) => {
                setPriceText(e.target.value);
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= 1 && n <= 200) set({ priceEuro: n });
              }}
              onBlur={() => setPriceText(null)}
              aria-label="Ticket price in euros"
            />
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
        <div className="choices" style={{ marginTop: 10 }} role="group" aria-label="Where it ends">
          <button className={`chip ${a.roundTrip !== false ? "on" : ""}`} onClick={() => set({ roundTrip: true })} aria-pressed={a.roundTrip !== false}>
            Finish near {a.startCity}
          </button>
          <button className={`chip ${a.roundTrip === false ? "on" : ""}`} onClick={() => set({ roundTrip: false })} aria-pressed={a.roundTrip === false}>
            Finish wherever the route ends
          </button>
        </div>
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
      {error && (errorAt === "plan" || !plan) ? (
        <p className="small bad" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}

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
                stops={stops.map((s, i) => ({
                  key: s.venueId,
                  day: s.day,
                  city: s.city,
                  venueName: s.venueName ?? s.venueId,
                  lat: where.get(s.venueId)!.lat,
                  lng: where.get(s.venueId)!.lng,
                  detail: `up to ${(s.capacity * FANS_PER_TICKET).toLocaleString()} fans (room ${where.get(s.venueId)!.capacity.toLocaleString()}) · venue takes ${s.venueBps / 100}%`,
                  // the band arranges the route itself: earlier, later, or not at all
                  right: busy ? null : (
                    <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                      <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Play ${s.city} earlier`} title="Earlier">
                        ↑
                      </button>
                      <button className="icon-btn" disabled={i === stops.length - 1} onClick={() => move(i, 1)} aria-label={`Play ${s.city} later`} title="Later">
                        ↓
                      </button>
                      <button className="icon-btn" disabled={stops.length <= 2} onClick={() => drop(i)} aria-label={`Drop ${s.city}`} title="Drop this stop">
                        ✕
                      </button>
                    </span>
                  ),
                }))}
              />
              <RouteCheck plan={plan} home={cities.find((c) => c.name === a.startCity)} onReset={reset} />
              <DriveNote />
            </div>
          </div>
          <Money plan={plan} />
          <div className="row" style={{ marginTop: 16 }}>
            {demo ? (
              <WalletButton>Connect a wallet to book</WalletButton>
            ) : (
              <button className="btn primary big" disabled={!!busy} onClick={book}>
                {busy ?? (partial ? "Finish booking" : "Book this tour")}
              </button>
            )}
            {partial ? null : (
              <button
                className="btn outline"
                disabled={!!busy}
                onClick={() => {
                  setPlan(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Change answers
              </button>
            )}
          </div>
          {/* what happened when the band pressed Book: right under the button, read out by screen readers */}
          <div id="book-status" aria-live="polite">
            {error && errorAt === "book" ? (
              <p className="book-error" role="alert">
                {error}
              </p>
            ) : null}
            {partial ? (
              <p className="small warn" role="status" style={{ marginTop: 12 }}>
                Your tour is open, but not every show went through ({partial.message}) Press Finish booking to add the missing shows to the same tour.
              </p>
            ) : null}
          </div>
          <p className="micro muted" style={{ marginTop: 10, maxWidth: 720 }}>
            {demo
              ? "This is a preview with the demo band. Connect your own wallet to set up your band and book a tour like this one."
              : "Your wallet asks you once and keeps a small deposit with each show. Nothing else is charged."}
          </p>
          <details className="micro muted" style={{ marginTop: 4, maxWidth: 720 }}>
            <summary>How the devnet demo works</summary>
            The deposit is about 0.005 SOL of devnet money per show. Each show sells a sample of the room: one ticket on chain stands for {FANS_PER_TICKET} fans.
            Prices are play money (€1 is {LAMPORTS_PER_EURO / 1e9} SOL), and sales run {SALES_MINUTES} minutes instead of months.
          </details>
        </section>
      ) : null}
    </div>
  );
}

/** What the band takes home and what it risks, before it books. */
function Money({ plan }: { plan: TourPlan }) {
  const m = planMoney(plan);
  const euro = (n: number) => `€${n.toLocaleString()}`;
  return (
    <div className="money" aria-label="Money">
      <div>
        <span className="label">Full house</span>
        <b>about {euro(m.selloutEuro)}</b>
        <span className="micro muted">
          for you, after the venues&apos; share{m.feePct ? ` and the ${m.feePct}% Greenroom fee` : ""} (you keep about {m.bandPct}%)
          {plan.answers.draw > Math.max(...plan.plan.map((s) => s.capacity)) * FANS_PER_TICKET
            ? `; on devnet a show sells at most ${(Math.max(...plan.plan.map((s) => s.capacity)) * FANS_PER_TICKET).toLocaleString()} fans' worth`
            : ""}
        </span>
      </div>
      <div>
        <span className="label">Each show goes ahead at</span>
        <b>half the tickets</b>
        <span className="micro muted">about {euro(m.targetEuro)} for you if every show just makes it</span>
      </div>
      <div>
        <span className="label">If a show misses</span>
        <b>fans get refunds</b>
        <span className="micro muted">automatically; you lose only the small deposit</span>
      </div>
    </div>
  );
}

/**
 * Does the route make sense? The drive home from the last stop, the longest
 * leg, and how the band's own order compares with the agent's suggestion.
 */
function RouteCheck({ plan, home, onReset }: { plan: TourPlan; home?: { name: string; lat: number; lng: number }; onReset: () => void }) {
  const where = new Map(plan.offers.map((o) => [o.venueId, o]));
  const km = (ids: string[]) => routeTotals(legs(ids.map((id) => where.get(id)!).filter(Boolean))).km;
  const ids = plan.plan.map((s) => s.venueId);
  const mine = km(ids);
  const theirs = km(plan.suggested.filter((id) => where.has(id)));
  const changed = ids.join() !== plan.suggested.join();
  const last = where.get(ids[ids.length - 1]);
  const homeLeg = home && last ? legs([last, home])[0] : null;
  return (
    <div className="micro" style={{ margin: "10px 0 6px", display: "grid", gap: 4 }}>
      {homeLeg ? (
        <span className={homeLeg.level === "travel-day" ? "bad" : homeLeg.level === "long" ? "warn" : "muted"}>
          Home from {last!.city}: {homeLeg.km.toLocaleString()} km, {formatMinutes(homeLeg.minutes)} to {home!.name}
          {homeLeg.level === "travel-day" ? ": a full day of driving after the last show" : homeLeg.level === "long" ? ": a long drive after the last show" : ""}.
        </span>
      ) : null}
      {plan.plan.some((s, i) => i > 0 && s.day - plan.plan[i - 1].day > 2) ? (
        <span className="muted">Days off come from the venues: the next room on the route had no free night sooner (and every third show is followed by a rest day).</span>
      ) : null}
      {changed ? (
        <span className={mine > theirs * 1.15 ? "warn" : "muted"}>
          Your order: {mine.toLocaleString()} km
          {mine > theirs ? `, ${(mine - theirs).toLocaleString()} km more than the agent's route` : mine < theirs ? `, ${(theirs - mine).toLocaleString()} km less than the agent's route` : ", same as the agent's route"}.{" "}
          <button className="link-btn micro" onClick={onReset}>
            Back to the agent&apos;s route
          </button>
        </span>
      ) : (
        <span className="muted">Use ↑ ↓ to change the order or ✕ to drop a stop; days and drives update as you go.</span>
      )}
    </div>
  );
}

/** What the planner needs to know about the band. */
type DemoBand = Pick<BandAccount, "name" | "genre" | "showsCompleted"> & { ticketsSoldTotal: number };
