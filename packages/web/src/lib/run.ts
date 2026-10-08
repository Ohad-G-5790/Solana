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

export async function getRun(): Promise<RunSummary | null> {
  const res = await fetch("/api/run", { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as RunSummary | null;
}

export async function getFeed(after = 0, limit = 200): Promise<FeedMessage[]> {
  const res = await fetch(`/api/feed?after=${after}&limit=${limit}`, { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as FeedMessage[];
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

export async function getWorld(): Promise<{ cities: WorldCity[]; venues: WorldVenue[] }> {
  const res = await fetch("/api/world", { cache: "force-cache" });
  if (!res.ok) return { cities: [], venues: [] };
  return (await res.json()) as { cities: WorldCity[]; venues: WorldVenue[] };
}
