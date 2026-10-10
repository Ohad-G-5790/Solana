"use client";

import { toVenueOffer, venueOfferHeuristic } from "@greenroom/agents/offers";
import { planTour } from "@greenroom/agents/planner";
import type { City } from "@greenroom/world";
import { drive, formatMinutes } from "@greenroom/world/geo";
import { useEffect, useMemo, useState } from "react";
import { SAMPLE_REQUESTS, venueDecides, type BandRequest, type BandRules, type VenueRules } from "@/lib/agents";
import { LAMPORTS_PER_EURO } from "@/lib/config";
import { getWorld, type WorldCity, type WorldVenue } from "@/lib/run";
import { RouteMap, type MapStop } from "./RouteMap";

const COUNTRIES = ["DE", "AT", "FR", "PL", "CZ"];

/**
 * A band agent's first try, in this browser: every venue answers its request
 * with the venue agents' rules, and the planner draws the route. Nothing is
 * sent anywhere and nothing is booked.
 */
export function BandAgentTest({ rules }: { rules: BandRules }) {
  const [world, setWorld] = useState<{ cities: WorldCity[]; venues: WorldVenue[] } | null>(null);
  useEffect(() => {
    void getWorld().then(setWorld);
  }, []);
  const result = useMemo(() => {
    if (!world) return null;
    const req = { genre: rules.genre, draw: rules.draw, targetPriceLamports: rules.priceEuro * LAMPORTS_PER_EURO, trackRecord: { showsCompleted: 0, ticketsSoldTotal: 0 } };
    const venues = world.venues.filter((v) => COUNTRIES.includes(v.country));
    const decisions = venues.map((v) => ({ v, d: venueOfferHeuristic(v as never, req) }));
    const offers = decisions.filter((x) => x.d.offer).map((x) => toVenueOffer(x.v as never, x.v.id, x.d, 14));
    const plan = planTour({
      band: { genre: rules.genre as never, draw: rules.draw, targetPriceLamports: req.targetPriceLamports, homeCity: rules.homeCity },
      offers,
      cities: world.cities as City[],
      wantedShows: 8,
      windowDays: 14,
      startCity: rules.homeCity,
      roundTrip: rules.roundTrip,
    });
    const byId = new Map(venues.map((v) => [v.id, v]));
    const stops = plan.map((p) => byId.get(p.venueId)!).filter(Boolean);
    const longest = stops.slice(1).reduce((m, s, i) => Math.max(m, drive(stops[i], s).minutes), 0);
    return { offers: offers.length, declined: decisions.length - offers.length, stops, longest };
  }, [world, rules]);

  if (!result) return <p className="muted small">Your agent is asking the venues…</p>;
  if (!result.stops.length)
    return <p className="small warn">No venue took the request: {rules.draw.toLocaleString()} people may be too few or too many for the rooms here. Try another size.</p>;
  const tooLong = result.longest > rules.maxDriveHours * 60;
  const map: MapStop[] = result.stops.map((s) => ({ key: s.id, label: s.city, lat: s.lat, lng: s.lng }));
  return (
    <div className="agent-test">
      <p className="small">
        <b>{result.offers} venues said yes</b>, {result.declined} said no. Your agent picked {result.stops.length} of them:
      </p>
      <p className="route-line">{result.stops.map((s) => s.city).join(" → ")}</p>
      <p className={`small ${tooLong ? "warn" : "muted"}`}>
        Longest drive {formatMinutes(result.longest)}
        {tooLong ? `: over your ${rules.maxDriveHours} h limit, so your agent would ask you before booking it.` : `, inside your ${rules.maxDriveHours} h limit.`}
      </p>
      <RouteMap stops={map} height={360} />
    </div>
  );
}

/** A venue agent's inbox: each band agent's request and the venue agent's answer, with its reason. */
export function VenueInbox({ rules, requests = SAMPLE_REQUESTS, limit }: { rules: VenueRules; requests?: BandRequest[]; limit?: number }) {
  const rows = requests.map((r) => ({ r, d: venueDecides(rules, r) }));
  const offers = rows.filter((x) => x.d.offer);
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <div className="inbox">
      <p className="small muted">
        {rows.length} band agents asked; your agent offered a night to <b className="good">{offers.length}</b> and declined {rows.length - offers.length}. Sample requests from
        fictional bands.
      </p>
      <ul>
        {shown.map(({ r, d }) => (
          <li key={r.band} className={d.offer ? "yes" : "no"}>
            <span className={`mark ${d.offer ? "yes" : "no"}`} aria-hidden>
              {d.offer ? "✓" : "✕"}
            </span>
            <div>
              <b>{r.band}</b>
              <span className="small muted">
                {r.genre} · {r.draw.toLocaleString()} people · €{r.priceEuro} · {r.showsPlayed ? `${r.showsPlayed} shows played` : "no record yet"} · from {r.homeCity}
              </span>
              <span className="small">{d.reasoning}</span>
            </div>
            {d.offer ? <span className="inbox-money">≈ €{d.venueEuro.toLocaleString()}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
