import { Keypair } from "@solana/web3.js";

/** Deterministic wallet from a 32-byte hex seed (as produced by @greenroom/world). */
export function keypairFromSeedHex(hex: string): Keypair {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("seed must be 32 bytes of hex");
  return Keypair.fromSeed(Buffer.from(hex, "hex"));
}
