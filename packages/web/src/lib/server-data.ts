import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { checkAnswer, deriveApprovals } from "@greenroom/agents/approvals";
import { approvalsFromMessages, type ApprovalsView } from "./approvals";

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
  const shows: Record<string, unknown>[] = [];
  let band: { id: string; name: string; authority: string; profile: string } | null = null;
  let brief: { countries: string[]; wantedShows: number; windowDays: number } | undefined;
  let approvals: string | undefined;
  let tour = "";
  for (const m of readTranscript(dir)) {
    const d = (m.data ?? {}) as Record<string, unknown>;
    if (m.kind === "tour.request") {
      // the history replay sends a request too; the last one is the current tour
      band = { id: String(d.bandId), name: String(d.bandName), authority: String(d.bandAuthority), profile: "" };
      brief = { countries: (d.countries as string[]) ?? [], wantedShows: Number(d.wantedShows ?? 0), windowDays: Number(d.windowDays ?? 0) };
      shows.length = 0;
    }
    if (m.kind === "approval.request") approvals = String(d.mode ?? "auto");
    if (m.kind === "show.proposed") {
      shows.push({
        show: d.show,
        city: d.city,
        venue: d.venueId,
        venueName: d.venueName,
        day: d.day,
        capacity: d.capacity,
        ticketsSold: 0,
        state: "proposed",
        date: 0,
        thresholdDeadline: 0,
        salesOpenAt: d.salesOpenAt,
        ticketPriceLamports: d.ticketPriceLamports,
        venueBps: d.venueBps,
        thresholdBps: d.thresholdBps,
        payees: [],
        replaces: d.replaces,
      });
    }
    if (m.kind === "note" && typeof d.tour === "string") tour = d.tour;
  }
  for (const s of shows) {
    const by = shows.find((x) => x.replaces === s.show);
    if (by) s.replacedBy = by.show;
  }
  if (brief && !brief.wantedShows) brief.wantedShows = shows.filter((s) => !s.replaces).length;
  return { runId: dir.split(/[\\/]/).pop(), cluster: "", band, brief, approvals, tour, shows, stats: {}, partial: true };
}

interface TranscriptLine {
  id: number;
  at: number;
  kind: string;
  from: string;
  text: string;
  data?: unknown;
}

function readTranscript(dir: string): TranscriptLine[] {
  const t = join(dir, "transcript.jsonl");
  if (!existsSync(t)) return [];
  const out: TranscriptLine[] = [];
  for (const line of readFileSync(t, "utf8").split("\n")) {
    if (!line) continue;
    try {
      out.push(JSON.parse(line) as TranscriptLine);
    } catch {
      /* the agents are mid-write; the next poll gets the whole line */
    }
  }
  return out;
}

function sentIds(dir: string): string[] {
  const f = join(dir, "decisions.jsonl");
  if (!existsSync(f)) return [];
  const ids: string[] = [];
  for (const line of readFileSync(f, "utf8").split("\n")) {
    try {
      const id = (JSON.parse(line) as { id?: unknown }).id;
      if (typeof id === "string") ids.push(id);
    } catch {
      /* skip */
    }
  }
  return ids;
}

/** Approval requests and decisions of the current run. */
export function readApprovals(): ApprovalsView {
  const dir = runDir();
  if (!dir) return { items: [], writable: false, sent: [] };
  const items = approvalsFromMessages(readTranscript(dir));
  const decided = new Set(items.filter((i) => i.decision).map((i) => i.request.id));
  return { items, writable: dir !== bundled, sent: sentIds(dir).filter((id) => !decided.has(id)) };
}

/**
 * Record the band's answer for the running agents (they poll decisions.jsonl).
 * Only pending requests of a run started with --approve can be answered.
 */
export function writeDecision(id: unknown, answer: unknown): { ok: true } | { ok: false; status: number; error: string } {
  const dir = runDir();
  if (!dir || dir === bundled) return { ok: false, status: 409, error: "No live run. Start one with npm run demo:approve." };
  if (typeof id !== "string") return { ok: false, status: 400, error: "id is required" };
  const item = deriveApprovals(readTranscript(dir)).find((i) => i.request.id === id);
  if (!item) return { ok: false, status: 404, error: `no request ${id} in the current run` };
  if (item.decision) return { ok: false, status: 409, error: "already decided" };
  if (item.request.mode !== "dashboard") return { ok: false, status: 409, error: "this run is on auto-pilot; start it with --approve to decide yourself" };
  if (item.request.expiresAt && Date.now() > item.request.expiresAt) return { ok: false, status: 409, error: "this offer has expired" };
  if (sentIds(dir).includes(id)) return { ok: false, status: 409, error: "already answered; the agent is picking it up" };
  const checked = checkAnswer(item.request, answer);
  if ("error" in checked) return { ok: false, status: 400, error: checked.error };
  appendFileSync(join(dir, "decisions.jsonl"), JSON.stringify({ id, answer: checked.answer, at: Date.now() }) + "\n");
  return { ok: true };
}

export function readFeed(after: number, limit: number): unknown[] {
  const dir = runDir();
  if (!dir) return [];
  return readTranscript(dir)
    .filter((m) => m.id > after)
    .slice(-limit);
}

export function readWorld(): { cities: unknown[]; venues: unknown[] } {
  const p = join(repoRoot, "data", "venues.json");
  const fallback = join(bundled, "venues.json");
  const file = existsSync(p) ? p : existsSync(fallback) ? fallback : null;
  if (!file) return { cities: [], venues: [] };
  const d = JSON.parse(readFileSync(file, "utf8")) as { cities: unknown[]; venues: Record<string, unknown>[] };
  return {
    cities: d.cities,
    venues: d.venues.map((v) => ({ id: v.id, name: v.name, city: v.city, country: v.country, capacity: v.capacity, lat: v.lat, lng: v.lng, genres: v.genres, website: v.website, notes: v.notes })),
  };
}
