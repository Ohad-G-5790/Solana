#!/usr/bin/env node
/**
 * Runs the Anchor program tests against a local validator (see local-validator.mjs
 * for why `anchor test` is not used on Windows).
 *
 * Usage: node scripts/test-program.mjs [--keep] [extra mocha args]
 */
import { spawnSync } from "node:child_process";
import { isWin, root, startValidator } from "./local-validator.mjs";

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const mochaArgs = args.filter((a) => a !== "--keep");

const v = await startValidator({ log: (l) => console.log(`[test-program] ${l}`) });
const mocha = spawnSync(
  isWin ? "npx.cmd" : "npx",
  ["ts-mocha", "-p", "./tsconfig.json", "-t", "1000000", "tests/**/*.ts", ...mochaArgs],
  { cwd: root, stdio: "inherit", shell: isWin, env: { ...process.env, ANCHOR_PROVIDER_URL: v.rpcUrl, ANCHOR_WALLET: v.wallet } }
);
if (!keep) v.stop();
else console.log("[test-program] --keep: validator left running");
process.exit(mocha.status ?? 1);
