import { FANS_PER_TICKET, LAMPORTS_PER_EURO } from "./config";
export const LAMPORTS_PER_SOL = 1_000_000_000;

export function sol(lamports: number | bigint | { toString(): string }, digits = 3): string {
  const n = Number(lamports.toString()) / LAMPORTS_PER_SOL;
  // devnet play money is tiny: never round a real amount down to "0 SOL"
  const d = n !== 0 && Math.abs(n) < 10 ** -digits ? 5 : digits;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: d })} SOL`;
}

/**
 * A band's own devnet tour in the band's units: on-chain tickets are a 1-in-20
 * sample and lamports are play money, so show fans and euros at full scale.
 */
export function fans(tickets: number): string {
  return (tickets * FANS_PER_TICKET).toLocaleString();
}
export function euros(lamports: number | bigint | { toString(): string }): string {
  return `€${Math.round((Number(lamports.toString()) / LAMPORTS_PER_EURO) * FANS_PER_TICKET).toLocaleString()}`;
}

export function short(address: string, n = 4): string {
  return `${address.slice(0, n)}…${address.slice(-n)}`;
}

export function timeLeft(unix: number, now: number): string {
  if (!now || !unix) return "…";
  const d = unix - now;
  if (d <= 0) return "passed";
  if (d < 60) return `${d}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m ${d % 60}s`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ${Math.floor((d % 3600) / 60)}m`;
  return `${Math.floor(d / 86400)}d`;
}

export function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.min(100, Math.round((part / whole) * 100));
}

/** Demo clocks are compressed; show the planned day as a November date for flavour. */
/** "Day 1 · Nov 3": days count from 1 for people; the run's day index starts at 0. */
export function dayLabel(day: number): string {
  return `Day ${day + 1} · ${demoDate(day)}`;
}

export function demoDate(day: number): string {
  const d = new Date(Date.UTC(2026, 10, 3 + day));
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
