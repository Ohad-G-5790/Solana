import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Keypair } from "@solana/web3.js";
import { base58Decode, readKeypairFile } from "./keyfile.ts";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Encode(bytes: Uint8Array): string {
  let n = BigInt("0x" + (Buffer.from(bytes).toString("hex") || "0"));
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

test("reads a keypair from a JSON array or a base58 export", () => {
  const kp = Keypair.generate();
  const dir = mkdtempSync(join(tmpdir(), "greenroom-key-"));
  writeFileSync(join(dir, "k.json"), JSON.stringify(Array.from(kp.secretKey)));
  writeFileSync(join(dir, "k.txt"), base58Encode(kp.secretKey) + "\n");
  assert.ok(readKeypairFile(join(dir, "k.json")).publicKey.equals(kp.publicKey));
  assert.ok(readKeypairFile(join(dir, "k.txt")).publicKey.equals(kp.publicKey));
  assert.deepEqual(Array.from(base58Decode("1112")), [0, 0, 0, 1]);
  writeFileSync(join(dir, "bad.txt"), "abc");
  assert.throws(() => readKeypairFile(join(dir, "bad.txt")), /64-byte/);
});
