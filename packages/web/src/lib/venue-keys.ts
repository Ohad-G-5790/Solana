import { BASE_PATH } from "./config";

type Keys = { authority: string; profile: string };

export interface VenueKeys {
  /** venue id -> the venue agent's wallet and its on-chain VenueProfile */
  byId: Map<string, Keys>;
  /** VenueProfile address -> venue id */
  byProfile: Map<string, string>;
}

let cache: Promise<VenueKeys> | null = null;

async function load(): Promise<VenueKeys> {
  try {
    const r = await fetch(`${BASE_PATH}/venue-profiles.json`);
    if (!r.ok) throw new Error(`venue-profiles.json: HTTP ${r.status}`);
    const d = (await r.json()) as { venues: Record<string, Keys> };
    const byId = new Map<string, Keys>(Object.entries(d.venues));
    const byProfile = new Map<string, string>([...byId].map(([id, v]) => [v.profile, id]));
    return { byId, byProfile };
  } catch {
    cache = null; // try again next time
    return { byId: new Map(), byProfile: new Map() };
  }
}

/** public/venue-profiles.json (written by packages/agents/src/export-venue-profiles.ts); no RPC needed. */
export function venueKeys(): Promise<VenueKeys> {
  const p = cache ?? load();
  cache = p;
  return p;
}
