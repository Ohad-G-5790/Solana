import { readFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Base58 (Bitcoin alphabet) to bytes; what Phantom's "export private key" gives you. */
export function base58Decode(s: string): Uint8Array {
  const bytes: number[] = [0];
  for (const ch of s) {
    let carry = ALPHABET.indexOf(ch);
    if (carry < 0) throw new Error(`not base58: "${ch}"`);
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const ch of s) {
    if (ch !== "1") break;
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

/**
 * A wallet's secret key from a file: the Solana CLI's JSON array of 64
 * numbers, or the base58 string wallets like Phantom export.
 */
export function readKeypairFile(path: string): Keypair {
  const text = readFileSync(path, "utf8").trim();
  const bytes = text.startsWith("[") ? Uint8Array.from(JSON.parse(text) as number[]) : base58Decode(text);
  if (bytes.length !== 64) throw new Error(`${path}: expected a 64-byte secret key, got ${bytes.length} bytes`);
  return Keypair.fromSecretKey(bytes);
}
