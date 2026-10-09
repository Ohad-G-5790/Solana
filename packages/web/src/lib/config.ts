export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
export const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID ?? "4KSaYomRjbnijK1yAELZEGFMPsoPE6u7unY2T6mASUT8";
export const CLUSTER = process.env.NEXT_PUBLIC_CLUSTER ?? (/127\.0\.0\.1|localhost/.test(RPC_URL) ? "localnet" : "devnet");
/** How often pages re-read chain state: public RPCs rate-limit, a local validator does not. */
export const POLL_MS = CLUSTER === "localnet" ? 4000 : 15_000;
/** Prefix for fetches and links when the site is served under a sub-path (GitHub project pages). */
/**
 * The demo clock: one tour day is this many seconds between show dates on
 * chain (the agents and the browser booking both use it), so the dashboard can
 * turn dates back into "Day 3".
 */
export const DEMO_DAY_SEC = 2;
/** Devnet play money: a euro of ticket price is 10,000 lamports, so simulated fans can afford whole tours. */
export const LAMPORTS_PER_EURO = 10_000;
/** On devnet a show sells a sample of the room: one on-chain ticket stands for this many fans. */
export const FANS_PER_TICKET = 20;
/** The region the dashboard writes on tours it books; tells them apart from agent-booked tours. */
export const APP_REGION = "Greenroom app";
/** Ticket sales of a dashboard booking run this long before each show's deadline. */
export const SALES_SEC = 40 * 60;
/** Where the demo notice sends sign-up emails (a form service endpoint); empty hides the form. */
export const SIGNUP_URL = process.env.NEXT_PUBLIC_SIGNUP_URL ?? "";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function explorerUrl(kind: "address" | "tx", value: string): string {
  const base = `https://explorer.solana.com/${kind}/${value}`;
  if (CLUSTER === "localnet") return `${base}?cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`;
  if (CLUSTER === "mainnet") return base;
  return `${base}?cluster=${CLUSTER}`;
}
