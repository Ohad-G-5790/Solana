"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useBandSession } from "@/components/BandSession";
import { RegisterBand } from "@/components/Connect";
import { Feed } from "@/components/Feed";
import { fetchLiveTour } from "@/lib/chain-live";
import { DriveNote, Itinerary, type ItineraryStop } from "@/components/Itinerary";
import { RouteMap, type MapStop } from "@/components/RouteMap";
import { HealthBadge, ShowCard } from "@/components/ShowCard";
import { pendingItems, type ApprovalsView, type ApprovalView } from "@/lib/approvals";
import { explorerUrl } from "@/lib/config";
import { sol } from "@/lib/format";
import { chainTime, fetchShows, type ShowAccount } from "@/lib/greenroom";
import { bandTake, showView } from "@/lib/health";
import { getApprovals, getRun, getWorld, isStaticMode, type RunSummary, type WorldCity, type WorldVenue } from "@/lib/run";

export default function DashboardPage() {
  const session = useBandSession();
  // The band this page is about: the connected wallet, or the demo band (?band= overrides for links).
  const [paramBand] = useState(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("band")));
  const authority = paramBand ?? session.authority;
  const [run, setRun] = useState<RunSummary | null | undefined>(undefined);
  const [accounts, setAccounts] = useState<Map<string, ShowAccount | null>>(new Map());
  const [world, setWorld] = useState<{ cities: WorldCity[]; venues: WorldVenue[] }>({ cities: [], venues: [] });
  const [approvals, setApprovals] = useState<ApprovalsView | null>(null);
  const [now, setNow] = useState(0); // set from the chain clock on first poll
  const [rpcError, setRpcError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!authority) return;
      const bundled = await getRun();
      if (!alive) return;
      // The recorded/local run belongs to one band; any other band's tour comes
      // straight from chain state. Live mode on static hosting does the same for
      // the run's band, so a run executing anywhere is visible as it happens.
      const ownRun = bundled?.band.authority === authority;
      let r: RunSummary | null = ownRun ? bundled : null;
      if (!ownRun || isStaticMode() || paramBand) {
        try {
          const live = await fetchLiveTour(authority);
          if (live && live.shows.length) r = ownRun ? { ...bundled, ...live, band: { ...bundled?.band, ...live.band } } : live;
        } catch {
          /* chain unreachable; keep what we have */
        }
      }
      if (!alive) return;
      setRun(r);
      if (ownRun) void getApprovals().then((a) => alive && setApprovals(a));
      else setApprovals(null);
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
  }, [authority, paramBand]);

  const views = useMemo(() => (run ? [...run.shows].sort((a, b) => a.day - b.day || (a.replaces ? 1 : -1)).map((s) => showView(s, accounts.get(s.show), now)) : []), [run, accounts, now]);
  const venueById = useMemo(() => new Map(world.venues.map((v) => [v.id, v])), [world.venues]);

  const isWalletBand = !!session.wallet && authority === session.wallet;
  if (isWalletBand && session.profile === null) return <RegisterBand />;
  if (run === undefined || (isWalletBand && session.profile === undefined)) return <p className="muted">Loading…</p>;
  if (!run && isWalletBand && session.profile) return <NoTourYet name={session.profile.name} authority={authority!} />;
  if (!run) {
    return (
      <div className="card">
        <h2>No tour yet</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          Start the agents: <span className="mono">npm run demo:approve</span> to approve venues and the route yourself, or <span className="mono">npm run demo:fast</span> on
          auto-pilot. The negotiation, your decisions and every transaction show up here.
        </p>
      </div>
    );
  }

  const nameOf = (id: string, fallback?: string) => venueById.get(id)?.name ?? fallback ?? id.replace(/-/g, " ");
  const where = (venueId: string, city: string) => {
    const v = venueById.get(venueId);
    const c = world.cities.find((x) => x.name === city);
    return { lat: v?.lat ?? c?.lat ?? 0, lng: v?.lng ?? c?.lng ?? 0 };
  };
  const byShow = new Map(views.map((v) => [v.run.show, v]));
  const pending = pendingItems(approvals);
  const items = approvals?.items ?? [];
  const lastOf = (step: string) => [...items].reverse().find((i) => i.request.payload.step === step);
  const venuesItem = lastOf("venues");
  const routeItem = lastOf("route");

  // ---------- numbers ----------
  let sold = 0;
  let escrow = 0;
  let take = 0;
  const count = { onSale: 0, atRisk: 0, confirmed: 0, settled: 0, cancelled: 0 };
  for (const v of views) {
    if (v.state === "rejected") continue;
    sold += v.sold;
    escrow += v.escrowLamports;
    take += bandTake(v);
    if (v.state === "onSale") count.onSale++;
    if (v.health === "at-risk") count.atRisk++;
    if (v.state === "confirmed" || v.state === "settled") count.confirmed++;
    if (v.state === "settled") count.settled++;
    if (v.state === "cancelled") count.cancelled++;
  }

  // ---------- what needs the band ----------
  const attention: { key: string; tone: "wait" | "risk" | "bad" | "info"; text: ReactNode; cta?: ReactNode }[] = [];
  for (const i of pending) attention.push({ key: i.request.id, tone: "wait", text: <PendingLine item={i} />, cta: <Link className="btn primary small" href={`/approvals#${i.request.id}`}>Review</Link> });
  for (const v of views) {
    if (v.health === "at-risk") attention.push({ key: v.run.show, tone: "risk", text: <><b>{v.run.city}</b> is at risk: {v.status.toLowerCase()}. If it misses, fans are refunded and you get replacement options.</>, cta: <Link className="btn outline small" href={`/show?address=${v.run.show}`}>Open</Link> });
    if (v.state === "cancelled") {
      const rep = v.run.replacedBy ? byShow.get(v.run.replacedBy) : undefined;
      attention.push({
        key: v.run.show,
        tone: rep ? "info" : "bad",
        text: rep ? (
          <>
            <b>{v.run.city}</b> was cancelled ({v.sold}/{v.required}); replaced by {nameOf(rep.run.venue, rep.run.venueName)}, {rep.run.city}: <HealthBadge health={rep.health} />
          </>
        ) : (
          <>
            <b>{v.run.city}</b> was cancelled ({v.sold}/{v.required} sold); {v.sold > 0 ? "every fan was refunded" : "nobody had bought yet"}.
          </>
        ),
      });
    }
    if (v.state === "rejected" && !v.run.replaces) attention.push({ key: v.run.show, tone: "bad", text: <><b>{v.run.city}</b>: {nameOf(v.run.venue, v.run.venueName)} declined the proposal (the date was taken).</> });
    if (v.state === "rejected" && v.run.replaces) attention.push({ key: v.run.show, tone: "bad", text: <>The replacement in <b>{v.run.city}</b> was declined by the venue; that date is off.</> });
  }

  // ---------- stepper ----------
  const steps = [
    { label: "Offers", n: venuesItem?.request.payload.step === "venues" ? venuesItem.request.payload.offers.length : "–", done: !!venuesItem },
    { label: "Venues OK", n: venuesItem?.decision?.answer.step === "venues" ? venuesItem.decision.answer.venueIds.length : "–", done: !!venuesItem?.decision, now: !!venuesItem && !venuesItem.decision },
    { label: "Route OK", n: routeItem?.decision?.answer.approve && routeItem.request.payload.step === "route" ? routeItem.request.payload.stops.length : "–", done: !!routeItem?.decision?.answer.approve, now: !!routeItem && !routeItem.decision },
    { label: "On sale", n: count.onSale, done: views.length > 0 },
    { label: "Confirmed", n: count.confirmed, done: count.confirmed > 0 },
    { label: "Settled", n: count.settled, done: count.settled > 0 },
  ];
  if (!steps.some((s) => s.now)) {
    const idx = count.onSale > 0 ? 3 : views.length && count.confirmed > count.settled ? 4 : count.settled > 0 ? 5 : -1;
    if (idx >= 0) (steps[idx] as { now?: boolean }).now = true;
  }

  // ---------- route ----------
  const routeViews = views.filter((v) => v.state !== "rejected");
  const mapStops: MapStop[] = routeViews.map((v) => ({
    key: v.run.show,
    label: v.run.city,
    ...where(v.run.venue, v.run.city),
    tone: v.state === "cancelled" ? "cancelled" : v.health === "at-risk" ? "warn" : "ok",
    offRoute: v.state === "cancelled",
  }));
  const itinerary: ItineraryStop[] = routeViews.map((v) => ({
    key: v.run.show,
    day: v.run.day,
    city: v.run.city,
    venueName: nameOf(v.run.venue, v.run.venueName),
    ...where(v.run.venue, v.run.city),
    off: v.state === "cancelled",
    href: `/show?address=${v.run.show}`,
    right: <HealthBadge health={v.health} />,
    detail: v.run.replaces ? "replacement show" : undefined,
  }));
  const waitingRoute = views.length === 0 && routeItem && !routeItem.decision && routeItem.request.payload.step === "route" ? routeItem.request.payload : null;

  const cities = new Set(run.shows.map((s) => s.city));
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1>{run.band.name}</h1>
          <p className="muted">
            {run.brief ? `${run.brief.wantedShows}-show tour · ${run.brief.countries.join("/")} · ${run.brief.windowDays}-day window` : `Central Europe tour · ${cities.size} cities`}
            {" · "}
            {run.approvals === "dashboard" ? "you approve every step" : "auto-pilot approves"}
            {run.tour ? (
              <>
                {" · "}
                <a href={explorerUrl("address", run.tour)} target="_blank" rel="noreferrer">
                  tour on explorer ↗
                </a>
              </>
            ) : null}
            {run.partial ? " · run in progress" : ""}
          </p>
        </div>
        <div className="row">
          <Link href="/planner" className="btn outline">
            Plan a route
          </Link>
          <Link href={`/band?authority=${run.band.authority}`} className="btn outline">
            Track record
          </Link>
        </div>
      </div>

      {rpcError ? (
        <p className="small warn" style={{ marginTop: 8 }}>
          Live chain data unavailable ({rpcError}); showing the recorded run. Is the validator running and the RPC URL right?
        </p>
      ) : null}
      {isStaticMode() ? (
        <p className="small muted" style={{ marginTop: 8 }}>
          Recorded run. Show states are read live from {run.cluster.includes("devnet") ? "devnet" : "the chain"}; decisions are off here.
        </p>
      ) : null}

      <div className="attention" aria-label="Needs your attention">
        {attention.length === 0 ? (
          <div className="item">
            <div className="what small muted">
              <span className="dot" /> Nothing needs you right now.
            </div>
          </div>
        ) : (
          attention.map((a) => (
            <div key={`${a.tone}-${a.key}`} className="item">
              <div className="what small">
                <span className={`dot ${a.tone}`} />
                <span>{a.text}</span>
              </div>
              {a.cta}
            </div>
          ))
        )}
      </div>

      <div className="stepper" aria-label="Tour progress">
        {steps.map((s) => (
          <div key={s.label} className={`step ${s.done ? "done" : ""} ${(s as { now?: boolean }).now ? "now" : ""}`}>
            {s.label}
            <span className="n">{s.n}</span>
          </div>
        ))}
      </div>

      {views.length > 0 ? (
        <div className="stats">
          <Stat label="Tickets sold" value={sold} />
          <Stat label="In escrow" value={sol(escrow, 2)} />
          <Stat label="Your share" value={sol(take, 2)} hint="confirmed shows" />
          <Stat label="Confirmed" value={count.confirmed} />
          <Stat label="At risk" value={count.atRisk} tone={count.atRisk ? "warn" : undefined} />
          <Stat label="Cancelled" value={count.cancelled} tone={count.cancelled ? "bad" : undefined} />
        </div>
      ) : null}

      {views.length > 0 ? (
        <>
          <div className="section-title">
            <h2>Route</h2>
            <Link className="small muted" href="/planner?from=tour">
              Open in route planner →
            </Link>
          </div>
          <div className="split">
            <RouteMap stops={mapStops} venues={world.venues} />
            <div>
              <Itinerary stops={itinerary} />
              <DriveNote />
            </div>
          </div>

          <h2 style={{ margin: "24px 0 10px" }}>Shows</h2>
          <div className="grid">
            {views.map((v) => (
              <ShowCard
                key={v.run.show}
                v={v}
                now={now}
                venueName={nameOf(v.run.venue, v.run.venueName)}
                replacedByCity={v.run.replacedBy ? byShow.get(v.run.replacedBy)?.run.city : undefined}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Nothing is booked yet</h3>
          <p className="small muted" style={{ marginTop: 6 }}>
            The band agent books shows only after you approve the venues and the route.{" "}
            {pending.length ? <Link href="/approvals">Go to approvals →</Link> : "Waiting for venue offers…"}
          </p>
          {waitingRoute ? (
            <div style={{ marginTop: 12 }}>
              <Itinerary
                stops={waitingRoute.stops.map((s) => ({ key: s.venueId, day: s.day, city: s.city, venueName: nameOf(s.venueId, s.venueName), lat: s.lat, lng: s.lng }))}
              />
            </div>
          ) : null}
        </div>
      )}

      <h2 style={{ margin: "24px 0 10px" }}>On-chain, live</h2>
      <Feed limit={12} compact source="chain" />
      <p className="small" style={{ marginTop: 8 }}>
        <Link href="/feed">Full feed →</Link>
      </p>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "warn" | "bad" }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ""}`}>{value}</div>
      {hint ? <div className="micro muted">{hint}</div> : null}
    </div>
  );
}

function PendingLine({ item }: { item: ApprovalView }) {
  const p = item.request.payload;
  if (p.step === "venues")
    return (
      <>
        <b>Approve venues:</b> {p.offers.length} offers from {new Set(p.offers.map((o) => o.city)).size} cities are waiting for your yes or no.
      </>
    );
  if (p.step === "route")
    return (
      <>
        <b>Approve the route:</b> {p.stops.map((s) => s.city).join(" → ")} ({p.summary.km.toLocaleString()} km). Nothing is booked until you say so.
      </>
    );
  return (
    <>
      <b>{p.city} was cancelled:</b> {p.options.length} replacement option{p.options.length > 1 ? "s" : ""} to choose from.
    </>
  );
}

function NoTourYet({ name, authority }: { name: string; authority: string }) {
  return (
    <div>
      <h1>{name}</h1>
      <p className="muted">Your band is registered on-chain. No tour yet.</p>
      <div className="card" style={{ marginTop: 16, maxWidth: 760 }}>
        <h3>Book your first tour</h3>
        <p className="small muted" style={{ marginTop: 6 }}>
          Your band agent books tours with your wallet&apos;s key, so it runs on your machine, not in the browser. Export the wallet&apos;s private key into a file on your
          machine (keep it out of the repository) and start the agents as your band; this page then shows the tour as it is booked, and the Approvals page asks you about
          venues and the route.
        </p>
        <pre className="mono" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
          {`npm run demo:devnet -- --band-keypair ~/running-pigeons.key --band-name "${name}" --approve`}
        </pre>
        <p className="small muted" style={{ marginTop: 10 }}>
          Meanwhile: find rooms on the <Link href="/venues">Venues</Link> page and sketch a run in the <Link href="/planner">Route planner</Link>. Your record lives at{" "}
          <Link href={`/band?authority=${authority}`}>Band record</Link>.
        </p>
      </div>
    </div>
  );
}
