import type { ApprovalAnswer } from "@greenroom/agents/approvals";
import { approvalsFromMessages, type ApprovalsView } from "./approvals";
import { BASE_PATH } from "./config";

export interface RunShow {
  show: string;
  city: string;
  venue: string;
  venueName?: string;
  day: number;
  capacity: number;
  ticketsSold: number;
  state: string;
  date: number;
  thresholdDeadline: number;
  /** Runs recorded before approvals lack the fields below. */
  salesOpenAt?: number;
  ticketPriceLamports?: number;
  venueBps?: number;
  thresholdBps?: number;
  payees: { label: string; bps: number }[];
  replaces?: string;
  replacedBy?: string;
}

export interface RunSummary {
  runId: string;
  cluster: string;
  band: { id: string; name: string; authority: string; profile: string; homeCity?: string; genre?: string; draw?: number };
  brief?: { countries: string[]; wantedShows: number; windowDays: number };
  approvals?: "auto" | "dashboard";
  tour: string;
  shows: RunShow[];
  stats: Record<string, number | string>;
  /** Present while a run is still in progress (summary not yet written). */
  partial?: boolean;
  /** Booked in the dashboard (tour region APP_REGION): priced in demo euros, 1 ticket = FANS_PER_TICKET fans. */
  inApp?: boolean;
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
  website?: string;
  notes?: string;
}
export interface WorldCity {
  name: string;
  country: string;
  lat: number;
  lng: number;
  population?: number;
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

/** True once the API is known to be missing (static hosting): the dashboard is a replay. */
export function isStaticMode(): boolean {
  return staticMode;
}

export async function getRun(): Promise<RunSummary | null> {
  if (!staticMode) {
    const live = await getJson<RunSummary | null>("/api/run");
    if (live !== null) return live;
    staticMode = true;
  }
  return getJson<RunSummary>("/demo/summary.json");
}

let staticFeed: Promise<FeedMessage[]> | null = null;

function staticTranscript(): Promise<FeedMessage[]> {
  staticFeed ??= (async () => {
    try {
      const res = await fetch(`${BASE_PATH}/demo/transcript.jsonl`, { cache: "force-cache" });
      const text = res.ok ? await res.text() : "";
      return text
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as FeedMessage);
    } catch {
      return [];
    }
  })();
  return staticFeed;
}

export async function getFeed(after = 0, limit = 200): Promise<FeedMessage[]> {
  if (!staticMode) {
    const live = await getJson<FeedMessage[]>(`/api/feed?after=${after}&limit=${limit}`);
    if (live !== null) return live;
    staticMode = true;
  }
  return (await staticTranscript()).filter((m) => m.id > after).slice(-limit);
}

export async function getApprovals(): Promise<ApprovalsView> {
  if (!staticMode) {
    const live = await getJson<ApprovalsView>("/api/approvals");
    if (live !== null) return live;
    staticMode = true;
  }
  return { items: approvalsFromMessages(await staticTranscript()), writable: false, sent: [] };
}

/** Send the band's decision to the running agents. */
export async function sendDecision(id: string, answer: ApprovalAnswer): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${BASE_PATH}/api/approvals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, answer }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: body.error ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

let worldCache: Promise<{ cities: WorldCity[]; venues: WorldVenue[] }> | null = null;

export function getWorld(): Promise<{ cities: WorldCity[]; venues: WorldVenue[] }> {
  worldCache ??= (async () => {
    const live = staticMode ? null : await getJson<{ cities: WorldCity[]; venues: WorldVenue[] }>("/api/world");
    if (live) return live;
    const raw = await getJson<{ cities: WorldCity[]; venues: WorldVenue[] }>("/demo/venues.json");
    return raw ?? { cities: [], venues: [] };
  })();
  return worldCache;
}
