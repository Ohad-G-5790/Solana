import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CHECKS, type CheckResult } from "./checks.ts";

/**
 * QA bot entry point.
 *
 *   npm run qa                      run every check, merge judge scores, write the report
 *   npm run qa -- --skip a,b        skip slow checks by id
 *   npm run qa -- --only program    only one component
 *   npm run qa -- --no-loop         do not count this run as a loop (dry run)
 *
 * Judge scores: a rubric reviewer (a Claude subagent during development, or a
 * human) writes qa/judge/<component>.json as { "score": 1-10, "notes": "..." }.
 * Missing judge files fall back to the automated score so the loop never blocks.
 */
interface Rubric {
  passScore: number;
  maxLoops: number;
  automatedWeight: number;
  judgeWeight: number;
  components: { id: string; title: string; weight: number; judge: string }[];
}
interface State {
  loops: { n: number; at: string; overall: number; passed: boolean }[];
  stopped?: boolean;
}

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const qaDir = resolve(here, "..");
const rubric = JSON.parse(readFileSync(join(qaDir, "rubric.json"), "utf8")) as Rubric;
const statePath = join(qaDir, "state.json");
const state: State = existsSync(statePath) ? (JSON.parse(readFileSync(statePath, "utf8")) as State) : { loops: [] };

const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : (argv[i + 1] ?? "true");
};
const skip = new Set((opt("skip") ?? "").split(",").filter(Boolean));
const only = opt("only");
const noLoop = opt("no-loop") === "true";

if (state.stopped) {
  console.log(`QA bot is stopped: ${rubric.maxLoops} failed loops were reached. Delete qa/state.json to start a new series.`);
  process.exit(2);
}
const loopNo = noLoop ? state.loops.length : state.loops.length + 1;
console.log(`\nGreenroom QA bot — loop ${loopNo}${noLoop ? " (dry run)" : ""} of max ${rubric.maxLoops}; pass >= ${rubric.passScore}\n`);

const results: CheckResult[] = [];
for (const c of CHECKS) {
  if (skip.has(c.id) || (only && c.component !== only)) continue;
  const t0 = Date.now();
  process.stdout.write(`• ${c.id}: ${c.title} … `);
  let r: { ok: boolean; detail: string };
  try {
    r = await c.run(root);
  } catch (e) {
    r = { ok: false, detail: `threw: ${(e as Error).message}` };
  }
  const durationMs = Date.now() - t0;
  console.log(r.ok ? `ok (${(durationMs / 1000).toFixed(1)}s)` : `FAIL (${(durationMs / 1000).toFixed(1)}s)`);
  results.push({ id: c.id, component: c.component, title: c.title, ok: r.ok, critical: c.critical, detail: r.detail, command: c.command, durationMs });
}

interface ComponentScore {
  id: string;
  title: string;
  weight: number;
  automated: number;
  judge: number | null;
  judgeNotes?: string;
  score: number;
  checks: CheckResult[];
}

const components: ComponentScore[] = rubric.components.map((comp) => {
  const checks = results.filter((r) => r.component === comp.id);
  const passed = checks.filter((r) => r.ok).length;
  let automated = checks.length ? 1 + 9 * (passed / checks.length) : 1;
  if (checks.some((r) => r.critical && !r.ok)) automated = Math.min(automated, 3);
  automated = Math.round(automated * 10) / 10;
  const judgePath = join(qaDir, "judge", `${comp.id}.json`);
  let judge: number | null = null;
  let judgeNotes: string | undefined;
  if (existsSync(judgePath)) {
    const j = JSON.parse(readFileSync(judgePath, "utf8")) as { score: number; notes?: string };
    judge = Math.min(10, Math.max(1, Number(j.score)));
    judgeNotes = j.notes;
  }
  const score = Math.round((rubric.automatedWeight * automated + rubric.judgeWeight * (judge ?? automated)) * 10) / 10;
  return { id: comp.id, title: comp.title, weight: comp.weight, automated, judge, judgeNotes, score, checks };
});

const overall = Math.round(components.reduce((s, c) => s + c.weight * c.score, 0) * 100) / 100;
const passed = overall >= rubric.passScore;

// ---------- report ----------
const reportsDir = join(qaDir, "reports");
mkdirSync(reportsDir, { recursive: true });
const report = { loop: loopNo, at: new Date().toISOString(), overall, passed, passScore: rubric.passScore, components };
writeFileSync(join(reportsDir, `loop-${loopNo}.json`), JSON.stringify(report, null, 2));

const lines: string[] = [];
lines.push(`# QA report — loop ${loopNo} — overall **${overall.toFixed(2)} / 10** — ${passed ? "PASS" : "FAIL"} (pass ≥ ${rubric.passScore})`, "");
lines.push("| Component | Weight | Automated | Judge | Score |", "|---|---|---|---|---|");
for (const c of components) lines.push(`| ${c.title} | ${c.weight} | ${c.automated} | ${c.judge ?? "–"} | **${c.score}** |`);
lines.push("", "## Checks", "");
for (const c of components) {
  lines.push(`### ${c.title}`);
  if (c.judgeNotes) lines.push(`Judge: ${c.judgeNotes}`, "");
  for (const r of c.checks) {
    lines.push(`- ${r.ok ? "✅" : "❌"} ${r.id}: ${r.title}${r.critical ? " (critical)" : ""}`);
    if (!r.ok) {
      if (r.command) lines.push(`  - reproduce: \`${r.command}\``);
      lines.push("  - " + r.detail.trim().split("\n").slice(-6).join("\n    "));
    }
  }
  lines.push("");
}
writeFileSync(join(reportsDir, "latest.md"), lines.join("\n"));
console.log("\n" + lines.slice(0, 3 + components.length).join("\n"));
console.log(`\nFull report: qa/reports/latest.md`);

if (!noLoop) {
  state.loops.push({ n: loopNo, at: report.at, overall, passed });
  const failed = state.loops.filter((l) => !l.passed).length;
  if (!passed && failed >= rubric.maxLoops) {
    state.stopped = true;
    console.log(`\nSTOP: ${failed} failed loops reached the limit of ${rubric.maxLoops}. Final score ${overall}.`);
  }
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}
process.exit(passed ? 0 : 1);
