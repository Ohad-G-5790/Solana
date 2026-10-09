import { FANS_PER_TICKET } from "./config";

/**
 * A band's reputation, 0–10, from its on-chain record alone: how many fans a
 * played show draws (log scale, so 50 000 per night is the top) and how many
 * shows it has played (log scale, 300 is a seasoned touring act). A stadium
 * star with hundreds of shows is 10; a solid club band with a few played
 * tours is around 4–5. Pure arithmetic over public counters: anyone can check it.
 */
export function reputation(record: { showsCompleted: number; ticketsSoldTotal: number | bigint | { toString(): string } }): number {
  const shows = record.showsCompleted;
  if (shows <= 0) return 0;
  const fans = (Number(record.ticketsSoldTotal.toString()) * FANS_PER_TICKET) / shows;
  const draw = Math.log10(1 + fans) / Math.log10(1 + 50_000);
  const experience = Math.log10(1 + shows) / Math.log10(1 + 300);
  return Math.round(Math.min(10, 10 * (0.65 * Math.min(1, draw) + 0.35 * Math.min(1, experience))) * 10) / 10;
}

/** Where a score sits, in words, with the landmarks shown next to it. */
export const REPUTATION_SCALE: { at: number; label: string }[] = [
  { at: 2, label: "first gigs" },
  { at: 4, label: "club band" },
  { at: 6, label: "festival act" },
  { at: 8, label: "arena act" },
  { at: 10, label: "stadium star" },
];

export function reputationLabel(score: number): string {
  if (score === 0) return "no played shows yet";
  return REPUTATION_SCALE.find((s) => score <= s.at)?.label ?? "stadium star";
}
