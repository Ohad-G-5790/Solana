#!/usr/bin/env node
/**
 * Static build for GitHub Pages (or any static host).
 *
 * Next's `output: "export"` cannot include route handlers, so the API folder
 * is renamed to `_api` (underscore folders are private and ignored by the
 * router) for the duration of the build, then restored. The client falls back
 * to the bundled run in public/demo when the API is absent.
 *
 * Env: NEXT_PUBLIC_BASE_PATH (e.g. /Solana for a project page), NEXT_PUBLIC_RPC_URL,
 *      NEXT_PUBLIC_CLUSTER, NEXT_PUBLIC_PROGRAM_ID.
 */
import { spawnSync } from "node:child_process";
import { existsSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const api = join(web, "src", "app", "api");
const hidden = join(web, "src", "app", "_api");
const isWin = process.platform === "win32";

if (existsSync(hidden)) renameSync(hidden, api); // recover from an interrupted build
// Stale route type stubs from `next dev` would reference the hidden API routes.
for (const stale of ["dev", "types"]) rmSync(join(web, ".next", stale), { recursive: true, force: true });
renameSync(api, hidden);
let status = 1;
try {
  const r = spawnSync(isWin ? "npx.cmd" : "npx", ["next", "build"], {
    cwd: web,
    stdio: "inherit",
    shell: isWin,
    // a static site has no /api routes: the pages start in static mode instead of probing them
    env: { ...process.env, NEXT_OUTPUT: "export", NEXT_PUBLIC_STATIC: "1" },
  });
  status = r.status ?? 1;
} finally {
  renameSync(hidden, api);
}
if (status === 0) {
  writeFileSync(join(web, "out", ".nojekyll"), "");
  console.log(`static site written to ${join(web, "out")} (base path "${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}")`);
}
process.exit(status);
