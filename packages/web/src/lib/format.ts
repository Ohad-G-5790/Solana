export const LAMPORTS_PER_SOL = 1_000_000_000;

export function sol(lamports: number | bigint | { toString(): string }, digits = 3): string {
  const n = Number(lamports.toString()) / LAMPORTS_PER_SOL;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: digits })} SOL`;
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
export function demoDate(day: number): string {
  const d = new Date(Date.UTC(2026, 10, 3 + day));
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
