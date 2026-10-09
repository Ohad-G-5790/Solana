/**
 * Geography for tour planning: straight-line distance, an estimate of road
 * distance and van drive time, and stop ordering. No imports and no Node APIs,
 * so the dashboard can use it in the browser (`@greenroom/world/geo`).
 *
 * Road figures are estimates, not routing: road km = straight-line km x
 * ROAD_FACTOR (Central European motorway average), and drive time assumes a
 * loaded band van, not a car. Swap in a routing service for production.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Road km per straight-line km. Berlin–Munich is 1.16, Prague–Vienna 1.32; 1.2 is a fair middle. */
export const ROAD_FACTOR = 1.2;
/** Average splitter-van speed over a whole leg, motorway plus traffic (cars do ~105). */
export const VAN_KMH = 90;
/** Getting out of one city and into the next (ring roads, parking, load-in door). */
export const CITY_OVERHEAD_MIN = 20;
/** EU driver rule of thumb (Reg. 561/2006): a 45-minute break after 4.5 hours at the wheel. */
export const BREAK_AFTER_MIN = 270;
export const BREAK_MIN = 45;
/** Above this a show-day drive gets tight (load-in is usually mid-afternoon). */
export const LONG_DRIVE_MIN = 6 * 60;
/** Above this, plan a travel day: nobody should drive this and play the same night. */
export const TRAVEL_DAY_MIN = 9 * 60;

/** Great-circle distance in km between two coordinates. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Estimated road distance in km. */
export function roadKm(a: LatLng, b: LatLng): number {
  return distanceKm(a, b) * ROAD_FACTOR;
}

/** Estimated van drive time in minutes for a road distance, breaks included. */
export function driveMinutesForKm(km: number): number {
  if (km < 1) return 0;
  const wheel = CITY_OVERHEAD_MIN + (km / VAN_KMH) * 60;
  const breaks = Math.floor(wheel / BREAK_AFTER_MIN) * BREAK_MIN;
  return Math.round(wheel + breaks);
}

export type DriveLevel = "short" | "long" | "travel-day";

export interface Drive {
  /** Estimated road km, rounded. */
  km: number;
  /** Estimated van minutes including breaks. */
  minutes: number;
  level: DriveLevel;
}

export function driveLevel(minutes: number): DriveLevel {
  return minutes > TRAVEL_DAY_MIN ? "travel-day" : minutes > LONG_DRIVE_MIN ? "long" : "short";
}

/** Road km, drive minutes and how hard the leg is. Same-city moves count as zero. */
export function drive(a: LatLng, b: LatLng): Drive {
  const km = roadKm(a, b);
  const minutes = driveMinutesForKm(km);
  return { km: Math.round(km), minutes, level: driveLevel(minutes) };
}

/** "45m", "3h 05m". */
export function formatMinutes(min: number): string {
  if (min < 60) return `${Math.max(0, Math.round(min))}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export interface Leg {
  km: number;
  minutes: number;
  level: DriveLevel;
}

/** Legs between consecutive stops (length = stops.length - 1). */
export function legs(stops: LatLng[]): Leg[] {
  const out: Leg[] = [];
  for (let i = 1; i < stops.length; i++) out.push(drive(stops[i - 1], stops[i]));
  return out;
}

export interface RouteTotals {
  km: number;
  minutes: number;
  longest: Leg | null;
  longLegs: number;
  travelDayLegs: number;
}

export function routeTotals(l: Leg[]): RouteTotals {
  let longest: Leg | null = null;
  for (const x of l) if (!longest || x.minutes > longest.minutes) longest = x;
  return {
    km: l.reduce((s, x) => s + x.km, 0),
    minutes: l.reduce((s, x) => s + x.minutes, 0),
    longest,
    longLegs: l.filter((x) => x.level === "long").length,
    travelDayLegs: l.filter((x) => x.level === "travel-day").length,
  };
}

function pathKm(points: LatLng[], order: number[]): number {
  let total = 0;
  for (let i = 1; i < order.length; i++) total += distanceKm(points[order[i - 1]], points[order[i]]);
  return total;
}

/** Greedy order: always drive to the closest unvisited stop next. */
export function nearestNeighbourOrder(points: LatLng[], startIndex = 0): number[] {
  const n = points.length;
  if (n === 0) return [];
  const visited = new Array<boolean>(n).fill(false);
  const order = [startIndex];
  visited[startIndex] = true;
  while (order.length < n) {
    const last = points[order[order.length - 1]];
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const d = distanceKm(last, points[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    order.push(best);
    visited[best] = true;
  }
  return order;
}

/**
 * Classic 2-opt improvement on an open path; the first stop stays first. With
 * `returnTo`, the drive from the last stop back there counts too, so the route
 * ends near it (a round trip home) instead of wherever it happens to stop.
 */
export function twoOpt(points: LatLng[], order: number[], returnTo?: LatLng, keepLast = false): number[] {
  const len = (o: number[]) => pathKm(points, o) + (returnTo && o.length ? distanceKm(points[o[o.length - 1]], returnTo) : 0);
  let best = order.slice();
  let bestLen = len(best);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length - (keepLast ? 1 : 0); k++) {
        const candidate = best.slice(0, i).concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
        const l = len(candidate);
        if (l < bestLen - 1e-9) {
          best = candidate;
          bestLen = l;
          improved = true;
        }
      }
    }
  }
  return best;
}

/**
 * Shortest-looking route through every point, starting at `startIndex`. With
 * `returnTo` (a round trip), the stop nearest to it is played last and the
 * others are ordered in between, so the tour ends a short drive from home.
 */
export function optimizeOrder(points: LatLng[], startIndex = 0, returnTo?: LatLng): number[] {
  if (!returnTo || points.length < 3) return twoOpt(points, nearestNeighbourOrder(points, startIndex), returnTo);
  let end = -1;
  let bestD = Infinity;
  points.forEach((p, i) => {
    const d = distanceKm(p, returnTo);
    if (i !== startIndex && d < bestD) {
      bestD = d;
      end = i;
    }
  });
  // order everything but the last stop, then put it last and improve the middle
  const middle = points.map((_, i) => i).filter((i) => i !== end);
  const sub = nearestNeighbourOrder(middle.map((i) => points[i]), middle.indexOf(startIndex)).map((j) => middle[j]);
  return twoOpt(points, [...sub, end], returnTo, true);
}
