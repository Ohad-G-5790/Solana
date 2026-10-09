import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair } from "@solana/web3.js";
import { readKeypairFile } from "./keyfile.ts";
import { runDemo } from "./orchestrator.ts";

// Load <repo>/.env (KEY=value lines) without adding a dependency; the real environment wins.
const envFile = resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith("#") && m[2] !== "" && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

/**
 * npm run demo -w @greenroom/agents -- [--rpc https://api.devnet.solana.com] [--band <id>]
 *   [--shows 8] [--countries DE,AT,FR,PL,CZ] [--deadline 60] [--show 120]
 *   [--history] [--brain heuristic|claude] [--max-venues 40] [--fast]
 *   [--approve] [--replacement-timeout 300]
 *
 * --approve: the band decides in the dashboard (venues, route, replacement
 * shows) instead of auto-pilot; the run waits on the Approvals page.
 *
 * Your own band: [--band-keypair ~/band.json] [--band-name "The Running Pigeons"]
 *   [--genre indie] [--draw 400] [--home-city Berlin]
 * The key file is the Solana CLI's JSON array or a wallet's base58 export.
 * The band's wallet signs the band's transactions; --wallet still pays fees and fans.
 */
function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : "true";
}

const rpcUrl = arg("rpc", process.env.GREENROOM_RPC_URL ?? "https://api.devnet.solana.com")!;
const walletPath = arg("wallet", process.env.ANCHOR_WALLET ?? join(homedir(), ".config", "solana", "id.json"))!;
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(walletPath, "utf8"))));
const fast = arg("fast") === "true";
if (arg("brain")) process.env.GREENROOM_BRAIN = arg("brain");

const bandKeypairPath = arg("band-keypair");
const identity = {
  name: arg("band-name"),
  genre: arg("genre"),
  draw: arg("draw") ? Number(arg("draw")) : undefined,
  homeCity: arg("home-city"),
};
const hasIdentity = Object.values(identity).some((v) => v !== undefined);

const summary = await runDemo({
  rpcUrl,
  payer,
  bandId: arg("band"),
  bandKeypair: bandKeypairPath ? readKeypairFile(bandKeypairPath.replace(/^~(?=\/|$)/, homedir())) : undefined,
  bandIdentity: hasIdentity ? identity : undefined,
  wantedShows: Number(arg("shows", "8")),
  countries: arg("countries")?.split(","),
  deadlineAfterSec: Number(arg("deadline", fast ? "40" : "90")),
  showAfterSec: Number(arg("show", fast ? "75" : "180")),
  maxVenues: arg("max-venues") ? Number(arg("max-venues")) : undefined,
  history: arg("history") === "true",
  tickMs: fast ? 1000 : 2000,
  maxBuysPerTick: Number(arg("buys-per-tick", "36")),
  fansPerCity: Number(arg("fans", "60")),
  approvals: arg("approve") === "true" ? "dashboard" : "auto",
  replacementTimeoutSec: Number(arg("replacement-timeout", "300")),
});
console.log(JSON.stringify(summary.stats));
