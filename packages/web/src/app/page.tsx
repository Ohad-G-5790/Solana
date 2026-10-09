"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useBandSession } from "@/components/BandSession";
import { RegisterBand } from "@/components/Connect";
import { WalletPanel } from "@/components/WalletPanel";
import { Feed } from "@/components/Feed";
import { loadStory } from "@/lib/story";
import { fetchLiveTour } from "@/lib/chain-live";
import { DriveNote, Itinerary, type ItineraryStop } from "@/components/Itinerary";
import { RouteMap, type MapStop } from "@/components/RouteMap";
import { HealthBadge, ShowCard } from "@/components/ShowCard";
import { pendingItems, type ApprovalsView, type ApprovalView } from "@/lib/approvals";
import { CLUSTER, explorerUrl, POLL_MS, DEMO_DAY_SEC, FANS_PER_TICKET } from "@/lib/config";
import { isRateLimit } from "@/lib/rpc";
import { euros, fans, sol } from "@/lib/format";
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
    let first = true;
    const load = async () => {
      if (!authority) return;
      const bundled = await getRun();
      if (!alive) return;
      // Paint the recorded run right away; chain reads below only refresh it.
      if (first && bundled?.band.authority === authority) setRun((cur) => cur ?? bundled);
      first = false;
      // The recorded/local run belongs to one band; any other band's tour comes
      // straight from chain state. Live mode on static hosting does the same for
      // the run's band, so a run executing anywhere is visible as it happens.
      const ownRun = bundled?.band.authority === authority;
      let r: RunSummary | null = ownRun ? bundled : null;
      if (!ownRun || isStaticMode() || paramBand) {
        try {
          const live = await fetchLiveTour(authority);
          // the recorded run's own tour keeps its story (cluster, shows, replacements, feed);
          // a newer tour of the same band (booked after the recording) is shown as live
          if (live && live.shows.length) r = ownRun && bundled && live.tour === bundled.tour ? bundled : live;
        } catch (e) {
          // chain unreachable or busy: keep what we have and say so
          if (alive) setRpcError(describeRpcError(e));
          if (!ownRun) {
            setRun((cur) => (cur === undefined ? null : cur));
            return;
          }
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
          if (alive) setRpcError(describeRpcError(e));
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
    const t = setInterval(load, POLL_MS);
    // count seconds only once the chain clock is known (0 means "not yet")
    const tick = setInterval(() => setNow((n) => (n ? n + 1 : 0)), 1000);
    return () => {
      alive = false;
      clearInterval(t);
      clearInterval(tick);
    };
  }, [authority, paramBand]);

  const views = useMemo(() => (run ? [...run.shows].sort((a, b) => a.day - b.day || (a.replaces ? 1 : -1)).map((s) => showView(s, accounts.get(s.show), now, run.cluster === "live" && !!run.inApp)) : []), [run, accounts, now]);
  const venueById = useMemo(() => new Map(world.venues.map((v) => [v.id, v])), [world.venues]);

  const isWalletBand = !!session.wallet && authority === session.wallet;
  const panel = isWalletBand ? <WalletPanel /> : null;
  if (isWalletBand && session.profile === null)
    return (
      <>
        {panel}
        <RegisterBand />
      </>
    );
  if (isWalletBand && session.profile === undefined)
    return (
      <>
        {panel}
        <p className="muted">{session.profileError ? `Reading your band from ${CLUSTER}… (${describeRpcError(session.profileError)})` : "Reading your band…"}</p>
      </>
    );
  if (run === undefined) return <p className="muted">Loading the tour…</p>;
  if (!run && isWalletBand && session.profile)
    return (
      <>
        {rpcError ? <p className="small warn" style={{ marginBottom: 10 }}>{rpcError}</p> : null}
        <NoTourYet name={session.profile.name} authority={authority!} />
        {/* the next step first; wallet details below it */}
        <h2 style={{ margin: "28px 0 10px" }}>Your wallet</h2>
        {panel}
      </>
    );
  if (!run) {
    return (
      <div className="card">
        <h2>No tour yet</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          Nothing has been booked for this band yet. <Link href="/tour/new">Create a tour</Link> to get started.
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
  // a tour read from chain state was booked by the band itself (wizard or its own agents), not a recording
  const live = run.cluster === "live";
  // fans and euros only for tours priced on the dashboard's scale (agent-booked tours use real SOL prices)
  const inFans = live && !!run.inApp;
  const count = { proposed: 0, onSale: 0, atRisk: 0, confirmed: 0, settled: 0, cancelled: 0 };
  for (const v of views) {
    if (v.state === "rejected") continue;
    sold += v.sold;
    escrow += v.escrowLamports;
    take += bandTake(v);
    if (v.state === "proposed") count.proposed++;
    if (v.state === "onSale") count.onSale++;
    if (v.health === "at-risk") count.atRisk++;
    if (v.state === "confirmed" || v.state === "settled") count.confirmed++;
    if (v.state === "settled") count.settled++;
    if (v.state === "cancelled") count.cancelled++;
  }

  // ---------- what needs the band ----------
  const attention: { key: string; tone: "wait" | "risk" | "bad" | "info"; text: ReactNode; cta?: ReactNode }[] = [];
  for (const i of pending) attention.push({ key: i.request.id, tone: "wait", text: <PendingLine item={i} />, cta: <Link className="btn primary small" href={`/approvals#${i.request.id}`}>Review</Link> });
  if (count.proposed)
    attention.push({
      key: "proposed",
      tone: "info", // nothing for the band to do: not the "waiting for you" green
      text: (
        <>
          {count.proposed} of {views.length} shows wait for their venue to sign. Venues answer within about 10 minutes; nothing for you to do.
        </>
      ),
    });
  for (const v of views) {
    if (v.health === "at-risk") attention.push({ key: v.run.show, tone: "risk", text: <><b>{v.run.city}</b> is at risk: {v.status.toLowerCase()}. If it misses, every fan is refunded automatically{live ? "" : " and you get replacement options"}.</>, cta: <Link className="btn outline small" href={`/show?address=${v.run.show}`}>Open</Link> });
    if (v.state === "cancelled") {
      const rep = v.run.replacedBy ? byShow.get(v.run.replacedBy) : undefined;
      attention.push({
        key: v.run.show,
        tone: rep ? "info" : "bad",
        text: rep ? (
          <>
            <b>{v.run.city}</b> was cancelled ({inFans ? `${fans(v.sold)} of ${fans(v.required)} fans` : `${v.sold}/${v.required}`}); replaced by {nameOf(rep.run.venue, rep.run.venueName)}, {rep.run.city}: <HealthBadge health={rep.health} />
          </>
        ) : (
          <>
            <b>{v.run.city}</b> was cancelled ({inFans ? `${fans(v.sold)} of the ${fans(v.required)} fans it needed` : `${v.sold}/${v.required} sold`}); {v.sold > 0 ? "every fan was refunded" : "nobody had bought yet"}.
          </>
        ),
      });
    }
    if (v.state === "rejected" && !v.run.replaces) attention.push({ key: v.run.show, tone: "bad", text: <><b>{v.run.city}</b>: {nameOf(v.run.venue, v.run.venueName)} declined the proposal (the date was taken).</> });
    if (v.state === "rejected" && v.run.replaces) attention.push({ key: v.run.show, tone: "bad", text: <>The replacement in <b>{v.run.city}</b> was declined by the venue; that date is off.</> });
  }

  // ---------- stepper ----------
  const steps = live
    ? [
        { label: "Route approved", n: views.length, done: true },
        { label: "Venues signed", n: views.length - count.proposed - views.filter((v) => v.state === "rejected").length, done: count.proposed === 0, now: count.proposed > 0 },
        { label: "On sale", n: count.onSale, done: count.onSale + count.confirmed + count.cancelled > 0 },
        { label: "Confirmed", n: count.confirmed, done: count.confirmed > 0 },
        { label: "Paid out", n: count.settled, done: count.settled > 0 },
      ]
    : [
    { label: "Offers", n: venuesItem?.request.payload.step === "venues" ? venuesItem.request.payload.offers.length : "–", done: !!venuesItem },
    { label: "Venues OK", n: venuesItem?.decision?.answer.step === "venues" ? venuesItem.decision.answer.venueIds.length : "–", done: !!venuesItem?.decision, now: !!venuesItem && !venuesItem.decision },
    { label: "Route OK", n: routeItem?.decision?.answer.approve && routeItem.request.payload.step === "route" ? routeItem.request.payload.stops.length : "–", done: !!routeItem?.decision?.answer.approve, now: !!routeItem && !routeItem.decision },
    { label: "On sale", n: count.onSale, done: views.length > 0 },
    { label: "Confirmed", n: count.confirmed, done: count.confirmed > 0 },
    { label: "Settled", n: count.settled, done: count.settled > 0 },
  ];
  if (!steps.some((s) => (s as { now?: boolean }).now)) {
    const shift = live ? 1 : 0; // the live stepper has no "Offers" step
    const idx = count.onSale > 0 ? 3 - shift : views.length && count.confirmed > count.settled ? 4 - shift : count.settled > 0 ? 5 - shift : -1;
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
    // a band's own tour: each stop carries its progress, so the page needs no second list of shows
    detail: inFans ? `${fans(v.sold)} of ${fans(v.capacity)} fans · ${v.status}` : v.run.replaces ? "replacement show" : undefined,
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
            {live ? (isWalletBand ? "booked by you" : "live on devnet") : run.approvals === "dashboard" ? "you approve every step" : "auto-pilot approves"}
            {run.tour ? (
              <>
                {" · "}
                <a href={explorerUrl("address", run.tour)} target="_blank" rel="noreferrer">
                  tour on Solana ↗
                </a>
              </>
            ) : null}
            {run.partial ? " · run in progress" : ""}
          </p>
        </div>
        <div className="row">
          {isWalletBand ? (
            // while this tour still sells, a new one is not the next step
            <Link href="/tour/new" className={`btn ${count.proposed + count.onSale + count.confirmed - count.settled > 0 ? "outline" : "primary"}`}>
              New tour
            </Link>
          ) : null}
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
          {rpcError} Showing the last known state; the page retries by itself.
        </p>
      ) : null}
      {inFans ? (
        <p className="small muted" style={{ marginTop: 8 }}>
          A devnet demo at small scale: each ticket on chain stands for {FANS_PER_TICKET} fans, money is play money shown in euros, and a tour runs in about an
          hour instead of months (one tour day is {DEMO_DAY_SEC} seconds).
        </p>
      ) : null}
      {isStaticMode() && !live ? (
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

      <div className="stepper" aria-label="Tour progress" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s) => (
          <div key={s.label} className={`step ${s.done ? "done" : ""} ${(s as { now?: boolean }).now ? "now" : ""}`}>
            {s.label}
            <span className="n">{s.n}</span>
          </div>
        ))}
      </div>

      {views.length > 0 ? (
        <div className="stats">
          {inFans ? (
            <>
              <Stat label="Fans so far" value={fans(sold)} />
              <Stat label="Ticket money held" value={euros(escrow)} hint="back to fans if a show is cancelled" />
              <Stat label="Your share" value={euros(take)} hint="from shows that go ahead" />
            </>
          ) : (
            <>
              <Stat label="Tickets sold" value={sold} />
              <Stat label="Ticket money held" value={sol(escrow, 2)} hint="refunded if a show is cancelled" />
              <Stat label="Your share" value={sol(take, 2)} hint="confirmed shows" />
            </>
          )}
          {/* only news: a zero here is noise */}
          {count.atRisk ? <Stat label="At risk" value={count.atRisk} tone="warn" /> : null}
          {count.cancelled ? <Stat label="Cancelled" value={count.cancelled} tone="bad" /> : null}
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

          {inFans ? null : (
            <>
          <h2 style={{ margin: "24px 0 10px" }}>Shows</h2>
          <div className="grid">
            {views.map((v) => (
              <ShowCard
                key={v.run.show}
                v={v}
                now={now}
                venueName={nameOf(v.run.venue, v.run.venueName)}
                replacedByCity={v.run.replacedBy ? byShow.get(v.run.replacedBy)?.run.city : undefined}
                bandUnits={inFans}
              />
            ))}
          </div>
            </>
          )}
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

      {live ? null : <h2 style={{ margin: "24px 0 10px" }}>Agent feed of this recorded tour</h2>}
      {live ? (
        <Feed
          title={<h2 style={{ margin: "24px 0 10px" }}>Agent feed</h2>}
          story={run.tour ? loadStory(run.tour) : undefined}
          hideWhenEmpty
          limit={500}
          compact
          source="chain"
          shows={run.shows.map((s) => s.show)}
          cityOf={Object.fromEntries(run.shows.map((s) => [s.show, s.city]))}
          inFans={inFans}
          empty={sold > 0 ? "The step-by-step story is still loading from devnet; each stop above shows where it stands." : "Your shows are booked; nothing else has happened yet."}
        />
      ) : (
        <Feed limit={2000} compact source="transcript" />
      )}
      <p className="small" style={{ marginTop: 8 }}>
        <Link href="/feed">Open the agent feed →</Link>
      </p>
      {/* wallet details matter less than the tour: they sit below it */}
      {panel ? (
        <>
          <h2 style={{ margin: "24px 0 10px" }}>Your wallet</h2>
          {panel}
        </>
      ) : null}
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
      <p className="muted">Your band is set up. Time for the first tour.</p>
      <div className="cta">
        <div>
          <h2>Create your first tour</h2>
          <p className="small muted" style={{ marginTop: 6, maxWidth: 520 }}>
            Tell your agent how many people you bring, the ticket price, where to start and how long to go. It asks the venues, plans the route, and books it
            when you say yes.
          </p>
        </div>
        <Link className="btn primary big" href="/tour/new">
          Create your first tour
        </Link>
      </div>
      <p className="small muted" style={{ marginTop: 14 }}>
        Want to look around first? Find rooms on the <Link href="/venues">Venues</Link> page, sketch a run in the <Link href="/planner">Route planner</Link>, or open
        your <Link href={`/band?authority=${authority}`}>band record</Link>.
      </p>
    </div>
  );
}

function describeRpcError(e: unknown): string {
  const msg = String((e as Error)?.message ?? e);
  if (isRateLimit(msg)) return `${CLUSTER === "devnet" ? "The public devnet RPC" : "The RPC"} is rate-limiting this page (too many requests).`;
  if (CLUSTER === "localnet") return `Local validator unreachable (${msg.slice(0, 80)}). Is it running?`;
  return `Could not reach ${CLUSTER} (${msg.slice(0, 80)}).`;
}
