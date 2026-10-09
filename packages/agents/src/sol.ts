/** Lamports as the transcript shows them: "0.0057 SOL". One format for every agent. */
export function formatSol(lamports: number): string {
  return `${(lamports / 1e9).toLocaleString("en", { maximumFractionDigits: 5 })} SOL`;
}
