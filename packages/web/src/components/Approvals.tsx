"use client";

import type { AlternativeOption, ApprovalAnswer, ApprovalPayload, RouteStop, VenueChoice } from "@greenroom/agents/approvals";
import type { City } from "@greenroom/world";
import { planTour } from "@greenroom/agents/planner";
import { drive, formatMinutes, routeTotals, legs } from "@greenroom/world/geo";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ApprovalView } from "@/lib/approvals";
import { dayLabel, sol } from "@/lib/format";
import { sendDecision, type WorldCity, type WorldVenue } from "@/lib/run";
import { DriveNote, Itinerary } from "./Itinerary";
import { RouteMap } from "./RouteMap";

export interface DecisionContext {
  /** The server can hand decisions to a running agent. */
  writable: boolean;
  /** Ids answered here that the agent has not picked up yet. */
  sent: string[];
  venues: WorldVenue[];
  cities: WorldCity[];
  /** Called after a decision was sent, to refresh. */
  onSent: () => void;
}

const when = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");

function StatusChip({ item }: { item: ApprovalView }) {
  const d = item.decision;
  if (!d) return <span className="badge at-risk">waiting for you</span>;
  const yes = d.answer.approve;
  const label = d.by === "expired" ? "expired" : `${yes ? "approved" : d.answer.step === "route" && d.answer.dropVenueIds.length ? "changes asked" : "declined"} by ${d.by === "you" ? "you" : "auto-pilot"}`;
  return <span className={`badge ${d.by === "expired" ? "rejected" : yes ? "confirmed" : "cancelled"}`}>{label}</span>;
}

/** Buttons row with the reason they are disabled, if any. */
function Actions({ item, ctx, busy, error, children }: { item: ApprovalView; ctx: DecisionContext; busy: boolean; error: string | null; children: ReactNode }) {
  if (item.decision) return null;
  const sent = ctx.sent.includes(item.request.id);
  let why: string | null = null;
  if (!ctx.writable) why = "This is a recorded tour, so its decisions are already made.";
  else if (item.request.mode !== "dashboard") why = "This run is on auto-pilot.";
  return (
    <div className="actions">
      {sent ? <span className="small good">Sent. The band agent is picking it up…</span> : why ? <span className="small muted">{why}</span> : children}
      {busy ? <span className="small muted">sending…</span> : null}
      {error ? <span className="small bad">{error}</span> : null}
    </div>
  );
}

function useSend(item: ApprovalView, ctx: DecisionContext) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (answer: ApprovalAnswer) => {
    setBusy(true);
    setError(null);
    const r = await sendDecision(item.request.id, answer);
    setBusy(false);
    if (!r.ok) setError(r.error);
    else ctx.onSent();
  };
  const disabled = busy || !ctx.writable || item.request.mode !== "dashboard" || ctx.sent.includes(item.request.id) || !!item.decision;
  return { busy, error, send, disabled };
}

export function DecisionCard({ item, ctx }: { item: ApprovalView; ctx: DecisionContext }) {
  const p = item.request.payload;
  return (
    <section className={`decision ${item.decision ? "" : "pending"}`} id={item.request.id}>
      <div className="head">
        <div>
          <h2>{item.request.title}</h2>
          <p className="micro muted" style={{ marginTop: 4 }}>
            asked {when(item.requestedAt)}
            {item.decision && item.decidedAt ? ` · answered ${when(item.decidedAt)}` : ""}
            {item.legacy ? " · this run was recorded before band approvals, so auto-pilot decided" : ""}
          </p>
        </div>
        <StatusChip item={item} />
      </div>
      {p.step === "venues" ? <VenuesDecision item={item} p={p} ctx={ctx} /> : p.step === "route" ? <RouteDecision item={item} p={p} ctx={ctx} /> : <AlternativeDecision item={item} p={p} ctx={ctx} />}
    </section>
  );
}

// ---------- 1. venues ----------

type SortKey = "fit" | "home" | "name";

type Payload<S extends ApprovalPayload["step"]> = Extract<ApprovalPayload, { step: S }>;

function VenuesDecision({ item, p, ctx }: { item: ApprovalView; p: Payload<"venues">; ctx: DecisionContext }) {
  const pending = !item.decision;
  const initial = item.decision?.answer.step === "venues" ? item.decision.answer.venueIds : item.request.recommended.step === "venues" ? item.request.recommended.venueIds : [];
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial));
  const [country, setCountry] = useState<string>("all");
  const [onlyPicked, setOnlyPicked] = useState(!pending);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("fit");
  const { busy, error, send, disabled } = useSend(item, ctx);
  const names = useMemo(() => new Map(ctx.venues.map((v) => [v.id, v.name])), [ctx.venues]);
  const nameOf = (o: VenueChoice) => names.get(o.venueId) ?? o.venueName;
  const recommended = new Set(item.request.recommended.step === "venues" ? item.request.recommended.venueIds : []);
  const countries = [...new Set(p.offers.map((o) => o.country))].sort();

  const shown = p.offers.filter(
    (o) =>
      (country === "all" || o.country === country) &&
      (!onlyPicked || selected.has(o.venueId)) &&
      (!q || `${nameOf(o)} ${o.city}`.toLowerCase().includes(q.toLowerCase()))
  );
  const groups = new Map<string, VenueChoice[]>();
  for (const o of shown) groups.set(o.city, [...(groups.get(o.city) ?? []), o]);
  // Cities with a recommended venue first, then best fit, then closest to home.
  const fitKey = (list: VenueChoice[]): number[] => [list.some((o) => recommended.has(o.venueId)) ? 0 : 1, -Math.max(...list.map((o) => o.score)), Math.min(...list.map((o) => o.fromHomeKm))];
  const cityKey = (list: VenueChoice[]): number[] => (sort === "fit" ? fitKey(list) : sort === "home" ? [Math.min(...list.map((o) => o.fromHomeKm))] : []);
  const cmp = (a: number[], b: number[]) => a.reduce((r, x, i) => r || x - (b[i] ?? 0), 0);
  for (const list of groups.values()) list.sort((a, b) => Number(recommended.has(b.venueId)) - Number(recommended.has(a.venueId)) || b.score - a.score);
  const ordered = [...groups.entries()].sort((a, b) => cmp(cityKey(a[1]), cityKey(b[1])) || a[0].localeCompare(b[0]));

  // What the route would look like with this selection (the planner's draft; the agent decides next).
  const preview = useMemo(() => {
    if (!p.planning || ctx.cities.length === 0) return null;
    const offers = p.offers.filter((o) => selected.has(o.venueId));
    if (offers.length === 0) return null;
    const plan = planTour({ ...p.planning, offers, cities: ctx.cities as City[], wantedShows: p.wantedShows });
    const pts = plan.map((s) => offers.find((o) => o.venueId === s.venueId)!);
    const t = routeTotals(legs(pts));
    return { plan, t };
  }, [p, selected, ctx.cities]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const pickedCities = new Set(p.offers.filter((o) => selected.has(o.venueId)).map((o) => o.city));

  return (
    <>
      <p className="small" style={{ marginTop: 10 }}>
        {p.offers.length} venues in {new Set(p.offers.map((o) => o.city)).size} cities answered the brief for {p.wantedShows} shows.{" "}
        {pending
          ? "Tick the ones you are happy to play. The agent builds the route from these only, and draws replacement shows from the ones that do not make the route."
          : `${initial.length} were approved; the route and any replacement shows come from those.`}
        {p.homeCity ? ` Distances are from ${p.homeCity}.` : ""}
      </p>
      <div className="toolbar">
        <button className={`chip ${country === "all" ? "on" : ""}`} onClick={() => setCountry("all")}>
          All
        </button>
        {countries.map((c) => (
          <button key={c} className={`chip ${country === c ? "on" : ""}`} onClick={() => setCountry(c)}>
            {c}
          </button>
        ))}
        <button className={`chip ${onlyPicked ? "on" : ""}`} onClick={() => setOnlyPicked((x) => !x)}>
          {pending ? "Ticked only" : "Approved only"}
        </button>
        <input className="input wide" placeholder="Search venue or city" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort cities">
          <option value="fit">Recommended first</option>
          {p.homeCity ? <option value="home">Closest to home</option> : null}
          <option value="name">A–Z</option>
        </select>
        {pending ? (
          <>
            <span className="spacer" />
            <button className="btn small outline" onClick={() => setSelected(new Set(recommended))}>
              Tick recommended
            </button>
            <button className="btn small outline" onClick={() => setSelected(new Set(p.offers.map((o) => o.venueId)))}>
              Tick all
            </button>
            <button className="btn small outline" onClick={() => setSelected(new Set())}>
              Untick all
            </button>
          </>
        ) : null}
      </div>

      <div className="table-wrap">
        <div className="venue-row head">
          <span />
          <span>Venue</span>
          <span>Tickets</span>
          <span>Venue share</span>
          <span className="hide-sm">Free days</span>
          <span className="hide-sm">Fit</span>
        </div>
        {ordered.map(([city, list]) => (
          <div key={city} className="city-group">
            <div className="city-head">
              <b>{city}</b>
              <span className="muted small">{list[0].country}</span>
              {p.homeCity && list[0].fromHomeKm > 0 ? (
                <span className="muted micro">
                  {list[0].fromHomeKm.toLocaleString()} km · {formatMinutes(list[0].fromHomeMinutes)} from {p.homeCity}
                </span>
              ) : null}
            </div>
            {list.map((o) => (
              <label key={o.venueId} className="venue-row" style={{ cursor: pending ? "pointer" : "default" }}>
                <input type="checkbox" checked={selected.has(o.venueId)} disabled={!pending} onChange={() => toggle(o.venueId)} aria-label={`Approve ${nameOf(o)}`} />
                <span style={{ minWidth: 0 }}>
                  <b>{nameOf(o)}</b> {recommended.has(o.venueId) ? <span className="badge rec">recommended</span> : null}
                </span>
                <span className="small">
                  {o.offeredCapacity.toLocaleString()}
                  <span className="muted"> / {o.capacity.toLocaleString()}</span>
                </span>
                <span className="small">{o.askBps / 100}%</span>
                <span className="small hide-sm">{o.freeDays}</span>
                <span className="hide-sm" title={`fit ${Math.round(o.score * 100)}%`}>
                  <div className="fit">
                    <div style={{ width: `${Math.round(o.score * 100)}%` }} />
                  </div>
                </span>
                <span className="note micro muted">
                  {o.note} Min. ticket {sol(o.minPriceLamports)}.
                </span>
              </label>
            ))}
          </div>
        ))}
        {ordered.length === 0 ? <p className="small muted" style={{ marginTop: 10 }}>No venues match.</p> : null}
      </div>

      {preview ? (
        <div className="preview">
          <b>
            {selected.size} venue{selected.size === 1 ? "" : "s"} in {pickedCities.size} cit{pickedCities.size === 1 ? "y" : "ies"}.
          </b>{" "}
          {preview.plan.length ? (
            <>
              Draft route: {preview.plan.map((s) => s.city).join(" → ")} · {preview.plan.length} shows · {preview.t.km.toLocaleString()} km · longest drive{" "}
              {formatMinutes(preview.t.longest?.minutes ?? 0)}
              {preview.plan.length < p.wantedShows ? <span className="warn"> · only {preview.plan.length} of {p.wantedShows} shows fit</span> : null}
            </>
          ) : (
            <span className="warn">No route fits these venues&apos; free days.</span>
          )}
        </div>
      ) : null}

      <Actions item={item} ctx={ctx} busy={busy} error={error}>
        <button className="btn primary" disabled={disabled || selected.size === 0} onClick={() => send({ step: "venues", approve: true, venueIds: [...selected] })}>
          Approve {selected.size} venue{selected.size === 1 ? "" : "s"}
        </button>
        <button className="btn outline" disabled={disabled} onClick={() => send({ step: "venues", approve: false, venueIds: [] })}>
          Decline all
        </button>
      </Actions>
    </>
  );
}

// ---------- 2. route ----------

function RouteDecision({ item, p, ctx }: { item: ApprovalView; p: Payload<"route">; ctx: DecisionContext }) {
  const pending = !item.decision;
  const decidedDrop = item.decision?.answer.step === "route" ? item.decision.answer.dropVenueIds : [];
  const [drop, setDrop] = useState<Set<string>>(() => new Set(decidedDrop));
  const { busy, error, send, disabled } = useSend(item, ctx);
  const names = useMemo(() => new Map(ctx.venues.map((v) => [v.id, v.name])), [ctx.venues]);
  const nameOf = (s: RouteStop) => names.get(s.venueId) ?? s.venueName;
  const s = p.summary;
  const toggle = (id: string) =>
    setDrop((d) => {
      const n = new Set(d);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <p className="small" style={{ marginTop: 10 }}>
        {p.round > 1 ? "Re-planned with the requested changes. " : ""}
        {pending
          ? "Nothing is on-chain yet. Approve and the agent proposes these shows to the venues; untick a stop to get a new route without it."
          : item.decision?.answer.approve
            ? "Approved as shown; the agent then proposed these shows to the venues."
            : drop.size
              ? "Sent back for a new route without the struck-out stops."
              : "Declined; nothing was booked."}
      </p>
      <div className="stats">
        <div className="stat">
          <div className="label">Shows</div>
          <div className="value">
            {s.shows} <span className="muted small">in {s.days} days</span>
          </div>
        </div>
        <div className="stat">
          <div className="label">By road</div>
          <div className="value">
            {s.km.toLocaleString()} <span className="muted small">km</span>
          </div>
        </div>
        <div className="stat">
          <div className="label">Driving</div>
          <div className="value">{formatMinutes(s.driveMinutes)}</div>
        </div>
        <div className="stat">
          <div className="label">Longest leg</div>
          <div className={`value ${s.travelDayLegs ? "bad" : s.longLegs ? "warn" : ""}`}>{formatMinutes(s.longestLegMinutes)}</div>
        </div>
        <div className="stat">
          <div className="label">Your share, sold out</div>
          <div className="value">{sol(s.bandAtSelloutLamports, 2)}</div>
        </div>
      </div>
      <p className="small muted">
        Gross if every show just reaches its threshold: {sol(s.grossAtThresholdLamports, 2)}; sold out: {sol(s.grossAtSelloutLamports, 2)}. {s.daysOff} day{s.daysOff === 1 ? "" : "s"} off.
        {s.travelDayLegs ? <span className="bad"> {s.travelDayLegs} leg{s.travelDayLegs > 1 ? "s are" : " is"} too long to drive on a show day.</span> : null}
      </p>
      <div className="split" style={{ marginTop: 12 }}>
        <RouteMap
          venues={ctx.venues}
          stops={p.stops.map((x) => ({ key: x.venueId, label: x.city, lat: x.lat, lng: x.lng, tone: drop.has(x.venueId) ? "muted" : "ok", offRoute: drop.has(x.venueId) }))}
          height={360}
        />
        <div>
          <Itinerary
            stops={p.stops.map((x) => ({
              key: x.venueId,
              day: x.day,
              city: x.city,
              venueName: nameOf(x),
              lat: x.lat,
              lng: x.lng,
              off: drop.has(x.venueId),
              detail: `${x.capacity} tickets at ${sol(x.ticketPriceLamports)} · venue ${x.venueBps / 100}% · confirms at ${Math.ceil((x.capacity * x.thresholdBps) / 10_000)}`,
              right: pending ? (
                <input type="checkbox" checked={!drop.has(x.venueId)} onChange={() => toggle(x.venueId)} aria-label={`Keep ${x.city}`} title="Keep this stop" />
              ) : null,
            }))}
          />
          <DriveNote />
        </div>
      </div>
      <Actions item={item} ctx={ctx} busy={busy} error={error}>
        {drop.size === 0 ? (
          <button className="btn primary" disabled={disabled} onClick={() => send({ step: "route", approve: true, dropVenueIds: [] })}>
            Approve route and book
          </button>
        ) : (
          <button className="btn primary" disabled={disabled || drop.size >= p.stops.length} onClick={() => send({ step: "route", approve: false, dropVenueIds: [...drop] })}>
            Re-plan without {drop.size} stop{drop.size > 1 ? "s" : ""}
          </button>
        )}
        <button className="btn outline" disabled={disabled} onClick={() => send({ step: "route", approve: false, dropVenueIds: [] })}>
          Decline
        </button>
      </Actions>
    </>
  );
}

// ---------- 3. replacement ----------

const KIND_LABEL: Record<AlternativeOption["kind"], string> = {
  downsize: "Same venue, smaller",
  "same-city": "Smaller room in town",
  "nearby-city": "Nearby city",
};

function AlternativeDecision({ item, p, ctx }: { item: ApprovalView; p: Payload<"alternative">; ctx: DecisionContext }) {
  const { busy, error, send, disabled } = useSend(item, ctx);
  const chosen = item.decision?.answer.step === "alternative" ? item.decision.answer.optionId : null;
  const names = new Map(ctx.venues.map((v) => [v.id, v.name]));
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const expires = item.request.expiresAt && !item.decision ? Math.max(0, Math.round((item.request.expiresAt - nowMs) / 1000)) : null;
  const original = ctx.venues.find((v) => v.id === p.venueId);
  return (
    <>
      <p className="small" style={{ marginTop: 10 }}>
        <b>
          {p.city}, {names.get(p.venueId) ?? p.venueName}
        </b>{" "}
        ({dayLabel(p.day)}) sold {p.ticketsSold} of the {p.required} tickets it needed, so the show is cancelled
        {p.ticketsSold > 0 ? " and every fan gets their money back automatically" : ""}. Pick a way to keep the date, or let it go.
        {expires !== null ? <span className="warn"> The offer lapses in about {expires}s.</span> : null}
      </p>
      <div className="options">
        {p.options.map((o) => {
          const fromOld = original ? drive(original, o) : null;
          return (
            <div key={o.id} className={`option ${chosen === o.id ? "chosen" : ""}`}>
              <span className="micro muted" style={{ textTransform: "uppercase", letterSpacing: 1.4, fontWeight: 700 }}>
                {KIND_LABEL[o.kind]}
              </span>
              <b>
                {names.get(o.venueId) ?? o.venueName}, {o.city}
              </b>
              <span className="small">
                {dayLabel(o.day)} · {o.capacity} tickets · confirms at <b>{o.required}</b>
              </span>
              <span className="small muted">
                Venue {o.venueBps / 100}% · {o.detourKm > 0 ? `+${o.detourKm} km to the tour` : "no extra driving"}
                {o.kind === "nearby-city" && fromOld ? ` · ${fromOld.km} km from ${p.city}` : ""}
                {o.driveInKm > 0 ? ` · ${formatMinutes(o.driveInMinutes)} in from the previous show` : ""}
              </span>
              <span className="micro muted">{o.reason}</span>
              {!item.decision ? (
                <button className="btn primary small" style={{ alignSelf: "flex-start", marginTop: 4 }} disabled={disabled} onClick={() => send({ step: "alternative", approve: true, optionId: o.id })}>
                  Book this
                </button>
              ) : chosen === o.id ? (
                <span className="small good">Booked</span>
              ) : null}
            </div>
          );
        })}
      </div>
      <Actions item={item} ctx={ctx} busy={busy} error={error}>
        <button className="btn outline" disabled={disabled} onClick={() => send({ step: "alternative", approve: false, optionId: null })}>
          No replacement
        </button>
      </Actions>
    </>
  );
}
