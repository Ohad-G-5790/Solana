/**
 * Convert a key file (Solana CLI JSON array or a wallet's base58 export) into
 * the JSON array the Solana CLI reads:  tsx src/keyfile-to-json.ts <in> <out>
 */
import { writeFileSync } from "node:fs";
import { readKeypairFile } from "./keyfile.ts";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: keyfile-to-json.ts <key file> <out.json>");
  process.exit(2);
}
writeFileSync(output, JSON.stringify(Array.from(readKeypairFile(input).secretKey)), { mode: 0o600 });
