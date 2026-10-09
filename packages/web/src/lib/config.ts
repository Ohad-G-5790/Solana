export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
export const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID ?? "4KSaYomRjbnijK1yAELZEGFMPsoPE6u7unY2T6mASUT8";
export const CLUSTER = process.env.NEXT_PUBLIC_CLUSTER ?? (/127\.0\.0\.1|localhost/.test(RPC_URL) ? "localnet" : "devnet");
/** How often pages re-read chain state: public RPCs rate-limit, a local validator does not. */
export const POLL_MS = CLUSTER === "localnet" ? 4000 : 15_000;
/** Prefix for fetches and links when the site is served under a sub-path (GitHub project pages). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function explorerUrl(kind: "address" | "tx", value: string): string {
  const base = `https://explorer.solana.com/${kind}/${value}`;
  if (CLUSTER === "localnet") return `${base}?cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`;
  if (CLUSTER === "mainnet") return base;
  return `${base}?cluster=${CLUSTER}`;
}
