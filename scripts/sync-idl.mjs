#!/usr/bin/env node
// Copies the Anchor-generated IDL and TypeScript types into the packages that
// ship them (the SDK and the dashboard), so builds work without the Rust toolchain.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const idl = join(root, "target", "idl", "greenroom.json");
const types = join(root, "target", "types", "greenroom.ts");
if (!existsSync(idl) || !existsSync(types)) {
  console.error("IDL not found; run `anchor build` first");
  process.exit(1);
}
for (const dest of ["packages/sdk/idl", "packages/web/src/idl"]) {
  mkdirSync(join(root, dest), { recursive: true });
  copyFileSync(idl, join(root, dest, "greenroom.json"));
  copyFileSync(types, join(root, dest, "greenroom.ts"));
}
console.log("IDL synced");
