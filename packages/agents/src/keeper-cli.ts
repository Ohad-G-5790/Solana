import { homedir } from "node:os";
import { join } from "node:path";
import { runKeeper } from "./keeper.ts";
import { readKeypairFile } from "./keyfile.ts";

/**
 * npm run keeper -w @greenroom/agents -- [--rpc URL] [--wallet PATH] [--minutes 7] [--fans 10] [--register 40]
 * One keeper run: venues sign, fans buy, the crank confirms, refunds and settles.
 */
function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : "true";
}

function num(name: string, def: string, min: number, max: number): number {
  const v = Number(arg(name, def));
  if (!Number.isFinite(v) || v < min || v > max) throw new Error(`--${name} must be a number from ${min} to ${max}`);
  return v;
}

const walletPath = arg("wallet", process.env.ANCHOR_WALLET ?? join(homedir(), ".config", "solana", "id.json"))!;
const stats = await runKeeper({
  rpcUrl: arg("rpc", process.env.GREENROOM_RPC_URL ?? "https://api.devnet.solana.com")!,
  payer: readKeypairFile(walletPath),
  minutes: num("minutes", "7", 0, 60),
  fansPerCity: num("fans", "10", 0, 60),
  registerVenues: num("register", "40", 0, 136),
});
console.log(JSON.stringify(stats));
// a run in which nothing worked (RPC down, wrong program) should fail the scheduled job
if (stats.failedTicks > 0 && stats.okTicks === 0) process.exit(1);
