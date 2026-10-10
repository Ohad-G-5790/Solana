/**
 * Rename a band on-chain; its track record stays as it is.
 *
 *   tsx src/rename-band-cli.ts --wallet <band key file> --name "Son of a Pigeon" [--rpc <url>]
 *
 * The band's own wallet signs and pays the fee. The key file is the Solana
 * CLI's JSON array or a wallet's base58 export.
 */
import { Connection } from "@solana/web3.js";
import { GreenroomClient } from "@greenroom/sdk";
import { readKeypairFile } from "./keyfile.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const walletPath = arg("wallet");
const name = arg("name")?.trim();
if (!walletPath || !name) {
  console.error('usage: rename-band-cli.ts --wallet <band key file> --name "New name" [--rpc <url>]');
  process.exit(2);
}
if (new TextEncoder().encode(name).length > 32) {
  console.error(`the name is ${new TextEncoder().encode(name).length} bytes; the program allows 32`);
  process.exit(2);
}
const rpcUrl = arg("rpc") ?? process.env.GREENROOM_RPC_URL ?? "https://api.devnet.solana.com";
const band = readKeypairFile(walletPath);
const client = GreenroomClient.fromKeypair(new Connection(rpcUrl, "confirmed"), band);

const before = await client.fetchBandByAuthority(band.publicKey);
if (before.name === name) {
  console.log(`${band.publicKey.toBase58()} is already called "${name}".`);
  process.exit(0);
}
const sig = await client.renameBand(band, name);
const after = await client.fetchBandByAuthority(band.publicKey);
console.log(`"${before.name}" is now "${after.name}" (${after.showsCompleted} shows played, ${after.ticketsSoldTotal.toString()} tickets kept). tx ${sig}`);
