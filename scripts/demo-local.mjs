#!/usr/bin/env node
/**
 * One-command local demo: starts a validator with the program, runs the agents
 * (band, venues, fans, crew, crank) end to end, prints the summary, stops the
 * validator. Pass --keep to leave the validator running for the dashboard.
 *
 * Usage: node scripts/demo-local.mjs [--fast] [--keep] [--history] [--shows 8] [--brain heuristic|claude]
 */
import { spawnSync } from "node:child_process";
import { isWin, root, startValidator } from "./local-validator.mjs";

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const passthrough = args.filter((a) => a !== "--keep");

const v = await startValidator({ log: (l) => console.log(`[demo] ${l}`) });
const r = spawnSync(isWin ? "npm.cmd" : "npm", ["run", "demo", "-w", "@greenroom/agents", "--", "--rpc", v.rpcUrl, "--wallet", v.wallet, ...passthrough], {
  cwd: root,
  stdio: "inherit",
  shell: isWin,
  env: { ...process.env, GREENROOM_RPC_URL: v.rpcUrl, ANCHOR_WALLET: v.wallet },
});
if (!keep) v.stop();
else console.log(`[demo] --keep: validator left running at ${v.rpcUrl}`);
process.exit(r.status ?? 1);
