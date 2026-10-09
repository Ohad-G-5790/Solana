"use client";

import type { WorldVenue } from "@/lib/run";

export type StopTone = "ok" | "cancelled" | "muted" | "warn";

export interface MapStop {
  key: string;
  label: string;
  lat: number;
  lng: number;
  tone?: StopTone;
  /** Left off the route line (cancelled without replacement, dropped). */
  offRoute?: boolean;
}

const W = 900;
const H = 440;
const REGION = { minLat: 42, maxLat: 55.5, minLng: -5, maxLng: 24 };

/**
 * Equirectangular map drawn as SVG, longitude scaled by cos(latitude) so
 * distances look right. It fits the stops (or the whole region when there are
 * fewer than two), shows every known venue as a grey dot, and joins the stops
 * in order with a dashed route.
 */
export function RouteMap({ stops, venues = [], height = H }: { stops: MapStop[]; venues?: WorldVenue[]; height?: number }) {
  const h = height;
  let { minLat, maxLat, minLng, maxLng } = REGION;
  if (stops.length >= 2) {
    minLat = Math.min(...stops.map((s) => s.lat));
    maxLat = Math.max(...stops.map((s) => s.lat));
    minLng = Math.min(...stops.map((s) => s.lng));
    maxLng = Math.max(...stops.map((s) => s.lng));
  }
  const midLat = (minLat + maxLat) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  // pad, then widen the narrow side so the aspect ratio matches the viewBox
  let spanX = Math.max(0.6, (maxLng - minLng) * k);
  let spanY = Math.max(0.6, maxLat - minLat);
  spanX *= 1.25;
  spanY *= 1.3;
  if (spanX / spanY > W / h) spanY = (spanX * h) / W;
  else spanX = (spanY * W) / h;
  const cx = ((minLng + maxLng) / 2) * k;
  const cy = (minLat + maxLat) / 2;
  const project = (lat: number, lng: number): [number, number] => [((lng * k - cx) / spanX + 0.5) * W, (0.5 - (lat - cy) / spanY) * h];
  const inView = ([x, y]: [number, number]) => x >= -10 && x <= W + 10 && y >= -10 && y <= h + 10;

  const placed = stops.map((s) => ({ ...s, xy: project(s.lat, s.lng) }));
  const onRoute = placed.filter((s) => !s.offRoute);
  const path = onRoute.map((s, i) => `${i === 0 ? "M" : "L"}${s.xy[0].toFixed(1)},${s.xy[1].toFixed(1)}`).join(" ");
  let n = 0;
  return (
    <svg className="map" viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`Route map: ${onRoute.map((s) => s.label).join(", ")}`}>
      {venues.map((v) => {
        const xy = project(v.lat, v.lng);
        return inView(xy) ? <circle key={v.id} className="venue" cx={xy[0]} cy={xy[1]} r={2} /> : null;
      })}
      {path && <path className="route" d={path} />}
      {placed.map((s) => {
        const label = s.offRoute ? s.label : `${++n}. ${s.label}`;
        return (
          <g key={s.key}>
            <circle className={`stop ${s.tone ?? "ok"}`} cx={s.xy[0]} cy={s.xy[1]} r={s.offRoute ? 5 : 6} />
            <text className={`label ${s.offRoute ? "off" : ""}`} x={s.xy[0] + 9} y={s.xy[1] + 4}>
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
