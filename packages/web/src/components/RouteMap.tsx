"use client";

import type { RunShow, WorldCity, WorldVenue } from "@/lib/run";

/**
 * Minimal equirectangular map of Central Europe drawn as SVG: every venue in
 * the world as a grey dot, the tour's stops in green (red if cancelled),
 * joined in order with a dashed route.
 */
const BOUNDS = { minLng: -5, maxLng: 24, minLat: 42, maxLat: 55.5 };
const W = 900;
const H = 440;

function project(lat: number, lng: number): [number, number] {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * W;
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * H;
  return [x, y];
}

export function RouteMap({ shows, venues, cities, states }: { shows: RunShow[]; venues: WorldVenue[]; cities: WorldCity[]; states: Map<string, string> }) {
  const stops = [...shows]
    .sort((a, b) => a.day - b.day)
    .map((s) => {
      const v = venues.find((x) => x.id === s.venue);
      const c = cities.find((x) => x.name === s.city);
      const lat = v?.lat ?? c?.lat;
      const lng = v?.lng ?? c?.lng;
      return lat !== undefined && lng !== undefined ? { ...s, xy: project(lat, lng) } : null;
    })
    .filter((s): s is RunShow & { xy: [number, number] } => s !== null);
  const path = stops.map((s, i) => `${i === 0 ? "M" : "L"}${s.xy[0].toFixed(1)},${s.xy[1].toFixed(1)}`).join(" ");
  return (
    <svg className="map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tour route map">
      {venues.map((v) => {
        const [x, y] = project(v.lat, v.lng);
        return <circle key={v.id} className="venue" cx={x} cy={y} r={2} />;
      })}
      {path && <path className="route" d={path} />}
      {stops.map((s, i) => {
        const st = states.get(s.show) ?? s.state;
        return (
          <g key={s.show}>
            <circle className={`stop ${st === "cancelled" ? "cancelled" : ""}`} cx={s.xy[0]} cy={s.xy[1]} r={6} />
            <text className="label" x={s.xy[0] + 9} y={s.xy[1] + 4}>
              {i + 1}. {s.city}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
