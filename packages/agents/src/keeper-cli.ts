import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Keypair } from "@solana/web3.js";
import { runKeeper } from "./keeper.ts";

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

const walletPath = arg("wallet", process.env.ANCHOR_WALLET ?? join(homedir(), ".config", "solana", "id.json"))!;
const stats = await runKeeper({
  rpcUrl: arg("rpc", process.env.GREENROOM_RPC_URL ?? "https://api.devnet.solana.com")!,
  payer: Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(walletPath, "utf8")))),
  minutes: Number(arg("minutes", "7")),
  fansPerCity: Number(arg("fans", "10")),
  registerVenues: Number(arg("register", "40")),
});
console.log(JSON.stringify(stats));
