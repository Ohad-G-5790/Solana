"use client";

import { drive, formatMinutes, optimizeOrder, type Drive } from "@greenroom/world/geo";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { DriveNote } from "@/components/Itinerary";
import { RouteMap } from "@/components/RouteMap";
import { loadPlan, savePlan } from "@/lib/planner-store";
import { getRun, getWorld, type RunSummary, type WorldCity, type WorldVenue } from "@/lib/run";

export default function PlannerPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <Planner />
    </Suspense>
  );
}

/**
 * A stop is a venue, or a whole city when the venue is still open
 * ("city:<name>" in the saved plan): every venue there stays a candidate.
 */
interface Stop {
  key: string;
  city: string;
  lat: number;
  lng: number;
  venue: WorldVenue | null;
  options: WorldVenue[];
}

const CITY = "city:";

function toStop(key: string, venues: WorldVenue[], cities: WorldCity[]): Stop | null {
  if (key.startsWith(CITY)) {
    const name = key.slice(CITY.length);
    const c = cities.find((x) => x.name === name);
    if (!c) return null;
    return { key, city: name, lat: c.lat, lng: c.lng, venue: null, options: venues.filter((v) => v.city === name).sort((a, b) => b.capacity - a.capacity) };
  }
  const v = venues.find((x) => x.id === key);
  if (!v) return null;
  return { key, city: v.city, lat: v.lat, lng: v.lng, venue: v, options: venues.filter((x) => x.city === v.city).sort((a, b) => b.capacity - a.capacity) };
}

const capRange = (vs: WorldVenue[]) => {
  if (!vs.length) return "";
  const caps = vs.map((v) => v.capacity);
  const lo = Math.min(...caps);
  const hi = Math.max(...caps);
  return lo === hi ? `${lo.toLocaleString()} cap` : `${lo.toLocaleString()}–${hi.toLocaleString()} cap`;
};

type Row =
  | { kind: "show"; day: number; stop: Stop; index: number; leg: Drive | null }
  | { kind: "travel"; day: number; from: string; to: string; leg: Drive }
  | { kind: "off"; day: number };

function schedule(stops: Stop[], restEvery: number): Row[] {
  const rows: Row[] = [];
  let day = 0;
  let sinceRest = 0;
  stops.forEach((v, i) => {
    const leg = i > 0 ? drive(stops[i - 1], v) : null;
    if (leg && leg.level === "travel-day") {
      // the drive takes the day; it doubles as the rest day
      rows.push({ kind: "travel", day: day++, from: stops[i - 1].city, to: v.city, leg });
      sinceRest = 0;
    } else if (i > 0 && restEvery > 0 && sinceRest >= restEvery) {
      rows.push({ kind: "off", day: day++ });
      sinceRest = 0;
    }
    rows.push({ kind: "show", day: day++, stop: v, index: i, leg: leg && leg.level === "travel-day" ? null : leg });
    sinceRest++;
  });
  return rows;
}

const fmtDate = (start: string, day: number) => {
  const d = new Date(`${start}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return `day ${day + 1}`;
  d.setUTCDate(d.getUTCDate() + day);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
};

function Planner() {
  const fromTour = useSearchParams().get("from") === "tour";
  const [world, setWorld] = useState<{ cities: WorldCity[]; venues: WorldVenue[] }>({ cities: [], venues: [] });
  const [run, setRun] = useState<RunSummary | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [restEvery, setRestEvery] = useState(3);
  const [start, setStart] = useState("2026-11-03");
  const [pickCity, setPickCity] = useState("");
  const [pickVenue, setPickVenue] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void getWorld().then(setWorld);
    void getRun().then(setRun);
    setIds(loadPlan());
  }, []);

  const tourIds = useMemo(
    () =>
      (run?.shows ?? [])
        .filter((s) => s.state !== "rejected" && s.state !== "cancelled")
        .sort((a, b) => a.day - b.day)
        .map((s) => s.venue),
    [run]
  );
  // ?from=tour loads the current tour once its data is in
  useEffect(() => {
    if (fromTour && tourIds.length) {
      setIds(tourIds);
      savePlan(tourIds);
    }
  }, [fromTour, tourIds]);

  const stops = useMemo(() => ids.map((id) => toStop(id, world.venues, world.cities)).filter((s): s is Stop => !!s), [ids, world]);
  const rows = schedule(stops, restEvery);
  const shows = rows.filter((r): r is Extract<Row, { kind: "show" }> => r.kind === "show");
  const legs = stops.slice(1).map((v, i) => drive(stops[i], v));
  const km = legs.reduce((s, l) => s + l.km, 0);
  const minutes = legs.reduce((s, l) => s + l.minutes, 0);
  const longest = legs.reduce((m, l) => Math.max(m, l.minutes), 0);
  const travelDays = rows.filter((r) => r.kind === "travel").length;
  const longLegs = legs.filter((l) => l.level === "long").length;
  const days = rows.length;

  const update = (next: string[]) => {
    setIds(next);
    savePlan(next);
    setCopied(false);
  };
  const move = (i: number, by: number) => {
    const next = [...ids];
    const [x] = next.splice(i, 1);
    next.splice(i + by, 0, x);
    update(next);
  };
  const optimize = () => {
    if (stops.length < 3) return;
    update(optimizeOrder(stops, 0).map((i) => stops[i].key));
  };
  const cityVenues = world.venues.filter((v) => v.city === pickCity).sort((a, b) => b.capacity - a.capacity);
  const pickKey = pickVenue || (pickCity ? `${CITY}${pickCity}` : "");
  const pin = (index: number, key: string) => update(ids.map((x, i) => (i === index ? key : x)));
  const label = (st: Stop) => (st.venue ? `${st.venue.name} (${st.venue.capacity} cap)` : `any of ${st.options.length} venues (${capRange(st.options)})`);

  const text = () =>
    [
      `Route plan (${shows.length} shows, ${days} days, ${km.toLocaleString()} km by road, ${formatMinutes(minutes)} driving; estimates)`,
      ...rows.map((r) =>
        r.kind === "show"
          ? `${fmtDate(start, r.day)}  ${r.stop.city}: ${label(r.stop)}${r.leg ? `  [${r.leg.km} km, ${formatMinutes(r.leg.minutes)} drive]` : ""}`
          : r.kind === "travel"
            ? `${fmtDate(start, r.day)}  travel day: ${r.from} to ${r.to} (${r.leg.km} km, ${formatMinutes(r.leg.minutes)})`
            : `${fmtDate(start, r.day)}  day off`
      ),
    ].join("\n");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1>Route planner</h1>
          <p className="muted" style={{ marginTop: 6, maxWidth: 760 }}>
            Sketch a run of shows and see what it means on the road: drive per leg, travel days for the long hauls, days off, and the whole tour length. Add stops
            here or from <Link href="/venues">Venues</Link>. Saved in this browser only.
          </p>
        </div>
      </div>

      <div className="toolbar">
        <select className="select" value={pickCity} onChange={(e) => {
            setPickCity(e.target.value);
            setPickVenue("");
          }} aria-label="City">
          <option value="">Add a city…</option>
          {world.cities
            .map((c) => c.name)
            .sort()
            .map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
        </select>
        {pickCity ? (
          <select className="select" value={pickVenue} onChange={(e) => setPickVenue(e.target.value)} aria-label="Venue">
            <option value="">Any venue ({cityVenues.length}, decide later)</option>
            {cityVenues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.capacity.toLocaleString()})
              </option>
            ))}
          </select>
        ) : null}
        <button
          className="btn small primary"
          disabled={!pickKey || ids.includes(pickKey)}
          onClick={() => {
            update([...ids, pickKey]);
            setPickVenue("");
          }}
        >
          {pickVenue ? "Add venue" : pickCity ? `Add ${pickCity}` : "Add stop"}
        </button>
        <span className="spacer" />
        {tourIds.length ? (
          <button className="btn small outline" onClick={() => update(tourIds)}>
            Load my tour
          </button>
        ) : null}
        <button className="btn small outline" disabled={stops.length < 3} onClick={optimize} title="Shortest order that keeps the first stop">
          Optimize order
        </button>
        <button className="btn small outline" disabled={stops.length < 2} onClick={() => update([...ids].reverse())}>
          Reverse
        </button>
        <button className="btn small outline" disabled={!ids.length} onClick={() => update([])}>
          Clear
        </button>
      </div>
      <div className="toolbar">
        <span className="small muted">First show</span>
        <input className="input" style={{ width: 160 }} type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="First show date" />
        <span className="small muted">Day off after</span>
        <select className="select" value={restEvery} onChange={(e) => setRestEvery(Number(e.target.value))} aria-label="Day off after N shows">
          <option value={0}>never</option>
          {[2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} shows
            </option>
          ))}
        </select>
        <span className="spacer" />
        <button className="btn small outline" disabled={!stops.length} onClick={copy}>
          {copied ? "Copied ✓" : "Copy itinerary"}
        </button>
      </div>

      {stops.length === 0 ? (
        <div className="card">
          <h3>No stops yet</h3>
          <p className="small muted" style={{ marginTop: 6 }}>
            Add a city above (the venue can stay open), pick venues on the <Link href="/venues">Venues</Link> page{tourIds.length ? ", or load your current tour" : ""}.
          </p>
        </div>
      ) : (
        <>
          <div className="stats">
            <Stat label="Shows" value={shows.length} />
            <Stat label="Tour length" value={`${days} days`} />
            <Stat label="By road" value={`${km.toLocaleString()} km`} />
            <Stat label="Driving" value={formatMinutes(minutes)} />
            <Stat label="Longest leg" value={formatMinutes(longest)} tone={travelDays ? "bad" : longLegs ? "warn" : undefined} />
            <Stat label="Travel days" value={travelDays} tone={travelDays ? "bad" : undefined} />
          </div>
          <div className="split">
            <RouteMap stops={stops.map((v) => ({ key: v.key, label: v.city, lat: v.lat, lng: v.lng }))} venues={world.venues} />
            <div>
              <div className="itinerary">
                {rows.map((r) =>
                  r.kind === "show" ? (
                    <div key={`s-${r.stop.key}`}>
                      {r.leg ? (
                        <div className={`leg ${r.leg.level}`}>
                          <span aria-hidden>↓</span>
                          <span>
                            {r.leg.km === 0 ? "same city" : `${r.leg.km.toLocaleString()} km · ${formatMinutes(r.leg.minutes)} drive`}
                            {r.leg.level === "long" ? " · long drive on a show day" : ""}
                          </span>
                        </div>
                      ) : null}
                      <div className="plan-stop">
                        <span className="micro muted">{fmtDate(start, r.day)}</span>
                        <div style={{ minWidth: 0 }}>
                          <span className="city" style={{ fontWeight: 700 }}>
                            {r.stop.city}
                          </span>{" "}
                          <select
                            className="venue-pick"
                            value={r.stop.venue?.id ?? ""}
                            onChange={(e) => pin(r.index, e.target.value || `${CITY}${r.stop.city}`)}
                            aria-label={`Venue in ${r.stop.city}`}
                          >
                            <option value="">Any venue · {r.stop.options.length} options · {capRange(r.stop.options)}</option>
                            {r.stop.options.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name} · {v.capacity.toLocaleString()} cap
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="controls">
                          <button className="icon-btn" aria-label={`Move ${r.stop.city} up`} disabled={r.index === 0} onClick={() => move(r.index, -1)}>
                            ↑
                          </button>
                          <button className="icon-btn" aria-label={`Move ${r.stop.city} down`} disabled={r.index === stops.length - 1} onClick={() => move(r.index, 1)}>
                            ↓
                          </button>
                          <button className="icon-btn" aria-label={`Remove ${r.stop.city}`} onClick={() => update(ids.filter((_, i) => i !== r.index))}>
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : r.kind === "travel" ? (
                    <div key={`t-${r.day}`} className="plan-stop travel bad">
                      <span className="micro">{fmtDate(start, r.day)}</span>
                      <span>
                        Travel day: {r.from} → {r.to}, {r.leg.km.toLocaleString()} km · {formatMinutes(r.leg.minutes)}
                      </span>
                      <span />
                    </div>
                  ) : (
                    <div key={`o-${r.day}`} className="plan-stop travel">
                      <span className="micro">{fmtDate(start, r.day)}</span>
                      <span>Day off</span>
                      <span />
                    </div>
                  )
                )}
              </div>
              <DriveNote />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "warn" | "bad" }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
