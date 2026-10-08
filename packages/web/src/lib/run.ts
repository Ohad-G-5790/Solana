import { BASE_PATH } from "./config";

export interface RunShow {
  show: string;
  city: string;
  venue: string;
  day: number;
  capacity: number;
  ticketsSold: number;
  state: string;
  date: number;
  thresholdDeadline: number;
  payees: { label: string; bps: number }[];
}

export interface RunSummary {
  runId: string;
  cluster: string;
  band: { id: string; name: string; authority: string; profile: string };
  tour: string;
  shows: RunShow[];
  stats: Record<string, number | string>;
  /** Present while a run is still in progress (summary not yet written). */
  partial?: boolean;
}

export interface FeedMessage {
  id: number;
  at: number;
  kind: string;
  from: string;
  to?: string;
  text: string;
  tx?: string;
  data?: unknown;
}

export interface WorldVenue {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: number;
  lat: number;
  lng: number;
  genres: string[];
}
export interface WorldCity {
  name: string;
  country: string;
  lat: number;
  lng: number;
}

/**
 * Data access with two sources: the API routes (Node server reading
 * data/runs) and, when those are absent (static export on GitHub Pages),
 * the run bundled under public/demo.
 */
async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_PATH}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!/json|octet-stream|text\/plain/.test(ct) && path.startsWith("/api/")) return null; // a 404 page, not data
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

let staticMode = false;

export async function getRun(): Promise<RunSummary | null> {
  if (!staticMode) {
    const live = await getJson<RunSummary | null>("/api/run");
    if (live !== null) return live;
    staticMode = true;
  }
  return getJson<RunSummary>("/demo/summary.json");
}

let staticFeed: FeedMessage[] | null = null;

export async function getFeed(after = 0, limit = 200): Promise<FeedMessage[]> {
  if (!staticMode) {
    const live = await getJson<FeedMessage[]>(`/api/feed?after=${after}&limit=${limit}`);
    if (live !== null) return live;
    staticMode = true;
  }
  if (!staticFeed) {
    try {
      const res = await fetch(`${BASE_PATH}/demo/transcript.jsonl`, { cache: "force-cache" });
      const text = res.ok ? await res.text() : "";
      staticFeed = text
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as FeedMessage);
    } catch {
      staticFeed = [];
    }
  }
  return staticFeed.filter((m) => m.id > after).slice(-limit);
}

export async function getWorld(): Promise<{ cities: WorldCity[]; venues: WorldVenue[] }> {
  const live = staticMode ? null : await getJson<{ cities: WorldCity[]; venues: WorldVenue[] }>("/api/world");
  if (live) return live;
  const raw = await getJson<{ cities: WorldCity[]; venues: WorldVenue[] }>("/demo/venues.json");
  return raw ?? { cities: [], venues: [] };
}
