"use client";

import type { VenueChoice } from "@greenroom/agents/approvals";
import { drive, formatMinutes, type Drive } from "@greenroom/world/geo";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DriveNote } from "@/components/Itinerary";
import { addToPlan, loadPlan, removeFromPlan } from "@/lib/planner-store";
import { getApprovals, getWorld, type WorldCity, type WorldVenue } from "@/lib/run";
import { useBandSession } from "@/components/BandSession";
import { useBandTour } from "@/components/useBandTour";

const SIZES = [
  { id: "any", label: "Any size", min: 0, max: Infinity },
  { id: "s", label: "Under 300", min: 0, max: 299 },
  { id: "m", label: "300–800", min: 300, max: 800 },
  { id: "l", label: "800–2,000", min: 801, max: 2000 },
  { id: "xl", label: "2,000+", min: 2001, max: Infinity },
];
const COUNTRY_NAMES: Record<string, string> = { DE: "Germany", AT: "Austria", FR: "France", PL: "Poland", CZ: "Czechia" };
const MAX_DRIVE = [
  { id: "any", label: "Any distance", minutes: Infinity },
  { id: "3", label: "Within 3 h", minutes: 180 },
  { id: "6", label: "Within 6 h", minutes: 360 },
  { id: "9", label: "Within 9 h", minutes: 540 },
];

type Sort = "distance" | "capacity" | "name";

export default function VenuesPage() {
  const [world, setWorld] = useState<{ cities: WorldCity[]; venues: WorldVenue[] }>({ cities: [], venues: [] });
  const { tour: run, mine } = useBandTour();
  const { guest } = useBandSession();
  const [offers, setOffers] = useState<Map<string, VenueChoice>>(new Map());
  const [plan, setPlan] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [size, setSize] = useState("any");
  const [genre, setGenre] = useState("any");
  const [from, setFrom] = useState("");
  const [maxDrive, setMaxDrive] = useState("any");
  const [sort, setSort] = useState<Sort>("distance");
  const go = (c: string | null, ci: string | null) => {
    setCountry(c);
    setCity(ci);
    setQ("");
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    void getWorld().then(setWorld);
    setPlan(loadPlan());
  }, []);
  // the recorded run's offers belong to the demo band: show them only while exploring it
  useEffect(() => {
    if (!guest || mine) return setOffers(new Map());
    void getApprovals().then((a) => {
      const venues = [...a.items].reverse().find((i) => i.request.payload.step === "venues");
      if (venues?.request.payload.step === "venues") setOffers(new Map(venues.request.payload.offers.map((o) => [o.venueId, o])));
    });
  }, [guest, mine]);

  const onTour = useMemo(() => new Set((run?.shows ?? []).filter((s) => s.state !== "rejected" && s.state !== "cancelled").map((s) => s.venue)), [run]);
  const defaultFrom = run?.band.homeCity ?? run?.shows[0]?.city ?? "Berlin";
  const origin = world.cities.find((c) => c.name === (from || defaultFrom));
  const genres = useMemo(() => [...new Set(world.venues.flatMap((v) => v.genres))].sort(), [world.venues]);
  const countries = useMemo(() => [...new Set(world.venues.map((v) => v.country))].sort(), [world.venues]);

  const sz = SIZES.find((s) => s.id === size)!;
  const md = MAX_DRIVE.find((m) => m.id === maxDrive)!;
  const driveTo = new Map<string, Drive>();
  for (const c of world.cities) if (origin) driveTo.set(c.name, drive(origin, c));

  const shown = world.venues.filter(
    (v) =>

      v.capacity >= sz.min &&
      v.capacity <= sz.max &&
      (genre === "any" || v.genres.includes(genre)) &&
      (md.minutes === Infinity || (driveTo.get(v.city)?.minutes ?? 0) <= md.minutes) &&
      (!q || `${v.name} ${v.city} ${v.country}`.toLowerCase().includes(q.toLowerCase()))
  );
  const byCity = new Map<string, WorldVenue[]>();
  for (const v of shown) byCity.set(v.city, [...(byCity.get(v.city) ?? []), v]);
  const cities = [...byCity.entries()].sort((a, b) => {
    if (sort === "distance") return (driveTo.get(a[0])?.km ?? 0) - (driveTo.get(b[0])?.km ?? 0);
    if (sort === "capacity") return Math.max(...b[1].map((v) => v.capacity)) - Math.max(...a[1].map((v) => v.capacity));
    return a[0].localeCompare(b[0]);
  });

  const active = [size !== "any" ? SIZES.find((x) => x.id === size)!.label : "", genre !== "any" ? genre : "", maxDrive !== "any" ? MAX_DRIVE.find((m) => m.id === maxDrive)!.label.toLowerCase() : ""].filter(Boolean).join(" · ");
  const clearFilters = () => {
    setSize("any");
    setGenre("any");
    setMaxDrive("any");
  };
  const togglePlan = (id: string) => setPlan(plan.includes(id) ? removeFromPlan(id) : addToPlan(id));

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1>Venues</h1>
          <p className="muted" style={{ marginTop: 6, maxWidth: 760 }}>
            {world.venues.length} real venues in {world.cities.length} cities. Pick a country, then a city, then a room, or search for one by name. Add what you like
            to the route planner. Capacities are approximate seed data; check with the venue.
          </p>
        </div>
        <Link href="/planner" className="btn outline">
          Route planner{plan.length ? ` (${plan.length})` : ""}
        </Link>
      </div>

      {/* country, then city, then the rooms: one decision at a time */}
      <nav className="crumbs small" aria-label="Where you are">
        <button className="link-btn small" onClick={() => go(null, null)} aria-current={!country && !city ? "page" : undefined}>
          All countries
        </button>
        {country ? (
          <>
            <span className="muted">›</span>
            <button className="link-btn small" onClick={() => go(country, null)} aria-current={!city ? "page" : undefined}>
              {COUNTRY_NAMES[country] ?? country}
            </button>
          </>
        ) : null}
        {city ? (
          <>
            <span className="muted">›</span>
            <b>{city}</b>
          </>
        ) : null}
      </nav>

      <div className="toolbar">
        <input className="input wide" placeholder="Search any venue or city" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <details className="filters">
        <summary className="small">
          Filters{active ? ` · ${active}` : ""}
        </summary>
        <div className="toolbar">
          <select className="select" value={size} onChange={(e) => setSize(e.target.value)} aria-label="Capacity">
            {SIZES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <select className="select" value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Programme">
            <option value="any">Any programme</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <span className="small muted">Drive from</span>
          <select className="select" value={from || defaultFrom} onChange={(e) => setFrom(e.target.value)} aria-label="Distance from">
            {world.cities
              .map((c) => c.name)
              .sort()
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                  {c === run?.band.homeCity ? " (home)" : ""}
                </option>
              ))}
          </select>
          <select className="select" value={maxDrive} onChange={(e) => setMaxDrive(e.target.value)} aria-label="Maximum drive">
            {MAX_DRIVE.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="distance">Closest first</option>
            <option value="capacity">Biggest room first</option>
            <option value="name">A–Z</option>
          </select>
          {active ? (
            <button className="link-btn small" onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
      </details>

      {q ? (
        <>
          <p className="small muted" style={{ marginBottom: 10 }}>
            {shown.length} venue{shown.length === 1 ? "" : "s"} match “{q}”
          </p>
          {cities.map(([c, list]) => cityCard(c, list))}
        </>
      ) : !country ? (
        <div className="tiles">
          {countries.map((c) => {
            const vs = shown.filter((v) => v.country === c);
            const cs = new Set(vs.map((v) => v.city));
            return (
              <button key={c} className="tile" onClick={() => go(c, null)} disabled={vs.length === 0}>
                <b>{COUNTRY_NAMES[c] ?? c}</b>
                <span className="small muted">
                  {cs.size} cities · {vs.length} venues
                </span>
              </button>
            );
          })}
        </div>
      ) : !city ? (
        <div className="tiles">
          {cities
            .filter(([, list]) => list[0]?.country === country)
            .map(([c, list]) => {
              const d = driveTo.get(c);
              const caps = list.map((v) => v.capacity);
              return (
                <button key={c} className="tile" onClick={() => go(country, c)}>
                  <b>{c}</b>
                  <span className="small muted">
                    {list.length} venue{list.length === 1 ? "" : "s"} · {Math.min(...caps).toLocaleString()}–{Math.max(...caps).toLocaleString()} people
                  </span>
                  {d ? (
                    <span className={`micro ${d.level === "travel-day" ? "bad" : d.level === "long" ? "warn" : "muted"}`}>
                      {d.km === 0 ? "home city" : `${d.km.toLocaleString()} km · ${formatMinutes(d.minutes)} from ${origin?.name}`}
                    </span>
                  ) : null}
                </button>
              );
            })}
        </div>
      ) : (
        cities.filter(([c]) => c === city).map(([c, list]) => cityCard(c, list))
      )}
      {shown.length === 0 && world.venues.length > 0 ? (
        <p className="muted">
          No venues match these filters.{" "}
          <button className="link-btn" onClick={clearFilters}>
            Clear filters
          </button>
        </p>
      ) : null}
      <DriveNote />
    </div>
  );

  function cityCard(city: string, list: WorldVenue[]) {
    const d = driveTo.get(city);
    const c = world.cities.find((x) => x.name === city);
    return (
      <div key={city} className="city-card">
        <div className="city-head">
          <div>
            <h3 style={{ display: "inline" }}>{city}</h3> <span className="muted small">{c?.country}</span>
            {c?.population ? <span className="muted micro"> · {(c.population / 1e6).toFixed(c.population >= 1e6 ? 1 : 2)}M people</span> : null}
          </div>
          <div className="row">
            {d ? (
              <span className={`small ${d.level === "travel-day" ? "bad" : d.level === "long" ? "warn" : "muted"}`}>
                {d.km === 0 ? "home city" : `${d.km.toLocaleString()} km · ${formatMinutes(d.minutes)} drive`}
              </span>
            ) : null}
            <button
              className={`btn small ${plan.includes(`city:${city}`) ? "" : "outline"}`}
              onClick={() => togglePlan(`city:${city}`)}
              aria-pressed={plan.includes(`city:${city}`)}
              title="Add the city as a stop and decide the venue later"
            >
              {plan.includes(`city:${city}`) ? "City in plan ✓" : "+ Plan city"}
            </button>
          </div>
        </div>
        {[...list]
          .sort((a, b) => b.capacity - a.capacity)
          .map((v) => {
            const o = offers.get(v.id);
            const added = plan.includes(v.id);
            return (
              <div key={v.id} className="vrow">
                <div style={{ minWidth: 0 }}>
                  <b>{v.name}</b>{" "}
                  {v.website ? (
                    <a className="micro muted" href={v.website} target="_blank" rel="noreferrer">
                      website ↗
                    </a>
                  ) : null}{" "}
                  {onTour.has(v.id) ? <span className="badge confirmed">{mine ? "on your tour" : "on the demo tour"}</span> : null}{" "}
                  {o ? <span className="badge rec">offered {o.offeredCapacity} tickets · {o.askBps / 100}%</span> : null}
                  {v.notes ? <div className="micro muted" style={{ marginTop: 2 }}>{v.notes}</div> : null}
                </div>
                <span className="small">{v.capacity.toLocaleString()} people</span>
                <span className="small muted hide-sm">{v.genres.join(", ")}</span>
                <button className={`btn small ${added ? "" : "outline"}`} onClick={() => togglePlan(v.id)} aria-pressed={added}>
                  {added ? "In plan ✓" : "+ Plan"}
                </button>
              </div>
            );
          })}
      </div>
    );
  }
}
