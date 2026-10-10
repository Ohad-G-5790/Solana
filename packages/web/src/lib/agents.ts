/**
 * Agents a visitor creates on the platform in a few clicks: a band agent that
 * books tours, or a venue agent that answers band agents. The rules are plain
 * data kept in this browser (localStorage); the decisions use the same
 * heuristics as the agents on devnet. Pure apart from the storage helpers.
 */

export type AgentKind = "band" | "venue";

export const GENRES = ["rock", "metal", "punk", "indie", "electronic", "hiphop", "jazz", "pop", "folk"] as const;

export interface BandRules {
  genre: string;
  homeCity: string;
  /** People the band brings on a typical night. */
  draw: number;
  priceEuro: number;
  /** Longest drive the agent accepts between two shows. */
  maxDriveHours: number;
  /** Finish the tour near home. */
  roundTrip: boolean;
}

export interface VenueRules {
  city: string;
  capacity: number;
  /** The lowest ticket price the venue books. */
  minPriceEuro: number;
  /** The venue's share of the ticket money it asks for. */
  sharePct: number;
  genres: string[];
}

export interface AgentConfig {
  id: string;
  kind: AgentKind;
  name: string;
  createdAt: number;
  band?: BandRules;
  venue?: VenueRules;
}

const KEY = "greenroom.agents";

export function loadAgents(): AgentConfig[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as AgentConfig[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveAgent(a: AgentConfig): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify([a, ...loadAgents().filter((x) => x.id !== a.id)]));
  } catch {
    /* storage blocked: the agent lives for this page view */
  }
}

export function removeAgent(id: string): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(loadAgents().filter((x) => x.id !== id)));
  } catch {
    /* nothing stored */
  }
}

/** The band agent the tour wizard starts from: the newest one. */
export function latestBandAgent(): AgentConfig | null {
  return loadAgents().find((a) => a.kind === "band" && a.band) ?? null;
}

/** The agent's rules as it would say them. */
export function describeAgent(a: AgentConfig): string[] {
  if (a.band) {
    const b = a.band;
    return [
      `Plays ${b.genre} and brings about ${b.draw.toLocaleString()} people a night.`,
      `Asks every venue on the way at once; tickets at €${b.priceEuro}.`,
      `No drive longer than ${b.maxDriveHours} hours between two shows.`,
      b.roundTrip ? `Starts in ${b.homeCity} and finishes near it.` : `Starts in ${b.homeCity}; finishes wherever the route ends.`,
      "Books nothing before you approve the route.",
    ];
  }
  if (a.venue) {
    const v = a.venue;
    return [
      `Answers band agents for a ${v.capacity.toLocaleString()}-capacity room in ${v.city}.`,
      `Books ${v.genres.join(", ")}; other genres only with a strong track record.`,
      `Tickets at €${v.minPriceEuro} or more; asks ${v.sharePct}% of the ticket money (5% more from bands with no record).`,
      "Signs on Solana only when the terms match; unsold shows refund every fan.",
    ];
  }
  return [];
}

/** A tour request as a venue agent receives it. */
export interface BandRequest {
  band: string;
  genre: string;
  draw: number;
  priceEuro: number;
  /** Shows the band has played and been paid for (its on-chain record). */
  showsPlayed: number;
  homeCity: string;
}

export interface VenueDecision {
  offer: boolean;
  sharePct: number;
  /** People the venue would sell to: the band's draw, at most the room. */
  fans: number;
  /** The venue's money at that many fans, in euros. */
  venueEuro: number;
  reasoning: string;
}

/**
 * The venue agent's answer, from its own rules: the band must fit the room
 * (a quarter to two and a half times its capacity), meet the ticket price,
 * and either play a booked genre or bring a record or a crowd.
 */
export function venueDecides(rules: VenueRules, req: BandRequest): VenueDecision {
  const genreFit = rules.genres.includes(req.genre);
  const ratio = req.draw / rules.capacity;
  const fits = ratio >= 0.25 && ratio <= 2.5;
  const priceOk = req.priceEuro >= rules.minPriceEuro;
  const strong = req.showsPlayed >= 3;
  const offer = fits && priceOk && (genreFit || strong || ratio >= 0.8);
  const sharePct = Math.min(40, rules.sharePct + (req.showsPlayed === 0 ? 5 : 0));
  const fans = Math.min(rules.capacity, req.draw);
  const venueEuro = Math.round(fans * req.priceEuro * (sharePct / 100));
  let reasoning: string;
  if (!fits) reasoning = `Declined: ${req.draw.toLocaleString()} people ${ratio < 0.25 ? "would leave our room empty" : "do not fit our room"} (${rules.capacity.toLocaleString()}).`;
  else if (!priceOk) reasoning = `Declined: €${req.priceEuro} is under our €${rules.minPriceEuro} minimum.`;
  else if (!offer) reasoning = `Declined: ${req.genre} is off our programme and the band has no record yet.`;
  else
    reasoning = `Offer: ${req.genre} ${genreFit ? "fits our programme" : "is off-programme, but the band has a record"}; ${req.draw.toLocaleString()} people in a ${rules.capacity.toLocaleString()} room; ${sharePct}% to us${req.showsPlayed === 0 ? " (no record yet)" : ""}.`;
  return { offer, sharePct, fans, venueEuro, reasoning };
}

/** Sample tour requests a venue agent receives in a season (fictional bands). */
export const SAMPLE_REQUESTS: BandRequest[] = [
  { band: "The Running Pigeons", genre: "indie", draw: 400, priceEuro: 30, showsPlayed: 5, homeCity: "Berlin" },
  { band: "Northern Static", genre: "rock", draw: 900, priceEuro: 35, showsPlayed: 12, homeCity: "Hamburg" },
  { band: "Velvet Ash", genre: "metal", draw: 650, priceEuro: 32, showsPlayed: 20, homeCity: "Prague" },
  { band: "Lena Kraus Trio", genre: "jazz", draw: 150, priceEuro: 25, showsPlayed: 30, homeCity: "Munich" },
  { band: "Bassline Doctors", genre: "electronic", draw: 1200, priceEuro: 28, showsPlayed: 8, homeCity: "Cologne" },
  { band: "Kids of Kreuzberg", genre: "punk", draw: 300, priceEuro: 18, showsPlayed: 3, homeCity: "Berlin" },
  { band: "Mira Sol", genre: "pop", draw: 2500, priceEuro: 45, showsPlayed: 40, homeCity: "Vienna" },
  { band: "Old Pine Folk", genre: "folk", draw: 220, priceEuro: 22, showsPlayed: 6, homeCity: "Leipzig" },
  { band: "Concrete Choir", genre: "hiphop", draw: 800, priceEuro: 30, showsPlayed: 15, homeCity: "Frankfurt" },
  { band: "Glass Harbour", genre: "indie", draw: 120, priceEuro: 15, showsPlayed: 0, homeCity: "Dresden" },
  { band: "Iron Saints", genre: "metal", draw: 1500, priceEuro: 40, showsPlayed: 60, homeCity: "Graz" },
  { band: "Night Ferry", genre: "rock", draw: 500, priceEuro: 25, showsPlayed: 0, homeCity: "Wrocław" },
];

export function newAgentId(): string {
  return `agent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
