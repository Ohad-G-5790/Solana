import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Server-side readers for run data. Order of precedence:
 *   1. GREENROOM_RUN_DIR env (explicit run folder)
 *   2. <repo>/data/runs/latest.json -> its dir
 *   3. the bundled demo run in public/demo (static hosts)
 */
const repoRoot = resolve(process.cwd(), "../..");
const dataRuns = join(repoRoot, "data", "runs");
const bundled = join(process.cwd(), "public", "demo");

export function runDir(): string | null {
  if (process.env.GREENROOM_RUN_DIR && existsSync(process.env.GREENROOM_RUN_DIR)) return process.env.GREENROOM_RUN_DIR;
  // Run folders are named by ISO timestamp, so the newest sorts last. A run in
  // progress (transcript but no summary yet) is still the one to show.
  if (existsSync(dataRuns)) {
    const dirs = readdirSync(dataRuns)
      .filter((d) => d !== "latest.json" && existsSync(join(dataRuns, d, "transcript.jsonl")))
      .sort()
      .reverse();
    if (dirs.length) return join(dataRuns, dirs[0]);
  }
  if (existsSync(join(bundled, "summary.json"))) return bundled;
  return null;
}

export function readSummary(): unknown | null {
  const dir = runDir();
  if (!dir) return null;
  const p = join(dir, "summary.json");
  if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  // in-progress run: synthesize a partial summary from the transcript
  const t = join(dir, "transcript.jsonl");
  if (!existsSync(t)) return null;
  const lines = readFileSync(t, "utf8").split("\n").filter(Boolean);
  const shows: Record<string, unknown>[] = [];
  let band: { id: string; name: string; authority: string; profile: string } | null = null;
  let tour = "";
  for (const line of lines) {
    const m = JSON.parse(line) as { kind: string; from: string; data?: Record<string, unknown>; text: string };
    if (m.kind === "show.proposed" && m.data) {
      shows.push({ show: m.data.show, city: m.data.city, venue: m.data.venueId, day: m.data.day, capacity: m.data.capacity, ticketsSold: 0, state: "proposed", date: 0, thresholdDeadline: 0, payees: [] });
      if (!band) band = { id: m.from.replace("band:", ""), name: String(m.data.bandName ?? m.from.replace("band:", "")), authority: String(m.data.bandAuthority), profile: "" };
    }
    if (m.kind === "note" && m.data && typeof m.data.tour === "string") tour = m.data.tour;
  }
  return { runId: dir.split(/[\\/]/).pop(), cluster: "", band, tour, shows, stats: {}, partial: true };
}

export function readFeed(after: number, limit: number): unknown[] {
  const dir = runDir();
  if (!dir) return [];
  const t = join(dir, "transcript.jsonl");
  if (!existsSync(t)) return [];
  const lines = readFileSync(t, "utf8").split("\n").filter(Boolean);
  const out: unknown[] = [];
  for (const line of lines) {
    const m = JSON.parse(line) as { id: number };
    if (m.id > after) out.push(m);
  }
  return out.slice(-limit);
}

export function readWorld(): { cities: unknown[]; venues: unknown[] } {
  const p = join(repoRoot, "data", "venues.json");
  const fallback = join(bundled, "venues.json");
  const file = existsSync(p) ? p : existsSync(fallback) ? fallback : null;
  if (!file) return { cities: [], venues: [] };
  const d = JSON.parse(readFileSync(file, "utf8")) as { cities: unknown[]; venues: Record<string, unknown>[] };
  return {
    cities: d.cities,
    venues: d.venues.map((v) => ({ id: v.id, name: v.name, city: v.city, country: v.country, capacity: v.capacity, lat: v.lat, lng: v.lng, genres: v.genres })),
  };
}
