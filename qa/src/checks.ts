import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { UI_CHECKS, type UiCheck } from "./ui-bot.ts";

export interface CheckResult {
  id: string;
  component: string;
  title: string;
  ok: boolean;
  /** Checks marked critical cap their component at 3 when they fail. */
  critical?: boolean;
  detail: string;
  command?: string;
  durationMs: number;
}

export interface CheckDef {
  id: string;
  component: string;
  title: string;
  critical?: boolean;
  /** Command to reproduce, shown in the report. */
  command?: string;
  run: (root: string) => Promise<{ ok: boolean; detail: string }> | { ok: boolean; detail: string };
}

const isWin = process.platform === "win32";

export function sh(cmd: string, args: string[], cwd: string, timeoutMs = 15 * 60_000): { ok: boolean; out: string; code: number | null } {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", shell: isWin, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NO_DNA: "1", FORCE_COLOR: "0" } });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return { ok: r.status === 0, out, code: r.status };
}

const tail = (s: string, n = 1200) => (s.length > n ? "…" + s.slice(-n) : s);

function fileHas(root: string, rel: string, needle: RegExp): boolean {
  const p = join(root, rel);
  return existsSync(p) && needle.test(readFileSync(p, "utf8"));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (["node_modules", "target", ".git", ".next", ".anchor", "runs"].includes(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** The UI bot drives the dashboard once; each of its checks reads that run. */
let uiRun: Promise<UiCheck[]> | null = null;
function uiBot(root: string): Promise<UiCheck[]> {
  uiRun ??= import("./ui-bot.ts").then((m) => m.runUiBot(root));
  return uiRun;
}

export const CHECKS: CheckDef[] = [
  // ---------- program ----------
  {
    id: "program-build",
    component: "program",
    title: "anchor build succeeds (SBPF v0, platform-tools v1.54)",
    critical: true,
    command: "npm run build:program",
    run: (root) => {
      const r = sh("npm", ["run", "build:program"], root);
      return { ok: r.ok && existsSync(join(root, "target/deploy/greenroom.so")), detail: tail(r.out) };
    },
  },
  {
    id: "program-clippy",
    component: "program",
    title: "cargo clippy reports no errors",
    command: "cargo clippy -p greenroom --no-deps -- -D warnings -A unexpected_cfgs",
    run: (root) => {
      const r = sh("cargo", ["clippy", "-p", "greenroom", "--no-deps", "--", "-D", "warnings", "-A", "unexpected_cfgs"], root);
      return { ok: r.ok, detail: tail(r.out) };
    },
  },
  {
    id: "program-tests",
    component: "program",
    title: "integration tests pass on a local validator",
    critical: true,
    command: "npm run test:program",
    run: (root) => {
      const r = sh("npm", ["run", "test:program"], root);
      const passing = /(\d+) passing/.exec(r.out)?.[1];
      const failing = /(\d+) failing/.exec(r.out)?.[1];
      return { ok: r.ok && !failing, detail: `${passing ?? "?"} passing, ${failing ?? 0} failing\n${tail(r.out, 800)}` };
    },
  },
  {
    id: "program-error-paths",
    component: "program",
    title: "every instruction has a happy-path and an error-path test",
    run: (root) => {
      const t = readFileSync(join(root, "tests/greenroom.ts"), "utf8");
      const ixs = ["registerBand", "registerVenue", "createTour", "proposeShow", "acceptShow", "rejectShow", "buyTicket", "checkThreshold", "refundTicket", "settleShow", "addPayee"];
      const missing = ixs.filter((ix) => !new RegExp(`\\.${ix}\\(`).test(t));
      const errorCodes = (t.match(/expectAnchorError\([\s\S]*?"([A-Za-z]+)"\s*\)/g) ?? []).length;
      return { ok: missing.length === 0 && errorCodes >= 15, detail: `missing: ${missing.join(", ") || "none"}; error-path assertions: ${errorCodes}` };
    },
  },
  {
    id: "program-safety",
    component: "program",
    title: "no init_if_needed, checked math on lamports, PDA-signed transfers",
    run: (root) => {
      const files = walk(join(root, "programs/greenroom/src")).filter((f) => f.endsWith(".rs"));
      const src = files.map((f) => readFileSync(f, "utf8")).join("\n");
      const problems: string[] = [];
      if (/init_if_needed/.test(src)) problems.push("init_if_needed used");
      if (!/checked_(add|sub|mul)/.test(src)) problems.push("no checked math");
      if (!/new_with_signer/.test(src)) problems.push("no PDA-signed CPI");
      if (/\.lamports\(\)\s*[+-]=/.test(src) || /try_borrow_mut_lamports/.test(src)) problems.push("direct lamport mutation");
      return { ok: problems.length === 0, detail: problems.join("; ") || "ok" };
    },
  },

  // ---------- agents ----------
  {
    id: "agents-typecheck",
    component: "agents",
    title: "agents and sdk packages type-check",
    critical: true,
    command: "npm run typecheck -w @greenroom/sdk -w @greenroom/agents",
    run: (root) => {
      const a = sh("npm", ["run", "typecheck", "-w", "@greenroom/sdk"], root);
      const b = sh("npm", ["run", "typecheck", "-w", "@greenroom/agents"], root);
      return { ok: a.ok && b.ok, detail: tail(a.out + b.out) };
    },
  },
  {
    id: "agents-unit",
    component: "agents",
    title: "planner, brain and bus unit tests pass",
    command: "npm test -w @greenroom/agents",
    run: (root) => {
      const r = sh("npm", ["test", "-w", "@greenroom/agents"], root);
      return { ok: r.ok && !/fail \d*[1-9]/.test(r.out), detail: tail(r.out, 600) };
    },
  },
  {
    id: "agents-e2e",
    component: "agents",
    title: "end-to-end demo on a local validator: shows booked, tickets sold, at least one cancellation fully refunded, settlements done",
    critical: true,
    command: "node scripts/demo-local.mjs --fast",
    run: (root) => {
      const r = sh("node", ["scripts/demo-local.mjs", "--fast"], root, 20 * 60_000);
      const m = /\{"proposed":[^}]+\}/.exec(r.out);
      if (!m) return { ok: false, detail: tail(r.out) };
      const s = JSON.parse(m[0]) as Record<string, number>;
      const ok = r.ok && s.accepted >= 5 && s.ticketsSold > 0 && s.settled >= 1 && s.cancelled >= 1 && s.refunded >= 1;
      return { ok, detail: `${m[0]}\n${ok ? "" : tail(r.out, 800)}` };
    },
  },
  {
    id: "agents-guardrails",
    component: "agents",
    title: "LLM answers are validated and never sign; heuristic path has no network dependency",
    run: (root) => {
      const brain = readFileSync(join(root, "packages/agents/src/brain.ts"), "utf8");
      const ok = /validate\?\.\(/.test(brain) && /HeuristicBrain/.test(brain) && !/signTransaction|Keypair/.test(brain);
      return { ok, detail: ok ? "brain validates model output and holds no keys" : "guardrail code missing" };
    },
  },

  // ---------- dashboard ----------
  {
    id: "web-build",
    component: "dashboard",
    title: "next build succeeds",
    critical: true,
    command: "npm run build -w @greenroom/web",
    run: (root) => {
      if (!existsSync(join(root, "packages/web/package.json"))) return { ok: false, detail: "packages/web missing" };
      const r = sh("npm", ["run", "build", "-w", "@greenroom/web"], root);
      return { ok: r.ok, detail: tail(r.out) };
    },
  },
  {
    id: "web-typecheck",
    component: "dashboard",
    title: "web package type-checks and lints",
    command: "npm run typecheck -w @greenroom/web && npm run lint -w @greenroom/web",
    run: (root) => {
      if (!existsSync(join(root, "packages/web/package.json"))) return { ok: false, detail: "packages/web missing" };
      const a = sh("npm", ["run", "typecheck", "-w", "@greenroom/web"], root);
      const b = sh("npm", ["run", "lint", "-w", "@greenroom/web"], root);
      return { ok: a.ok && b.ok, detail: tail(a.out + b.out) };
    },
  },
  {
    id: "web-design-tokens",
    component: "dashboard",
    title: "design tokens follow docs/DESIGN.md (near-black surfaces, #1ed760 accent, pill radius)",
    run: (root) => {
      const css = walk(join(root, "packages/web")).filter((f) => /\.(css|tsx?)$/.test(f) && !f.includes("node_modules"));
      const src = css.map((f) => readFileSync(f, "utf8")).join("\n").toLowerCase();
      const want = ["#121212", "#181818", "#1ed760", "#b3b3b3", "9999px"];
      const missing = want.filter((w) => !src.includes(w));
      return { ok: missing.length === 0 && css.length > 0, detail: missing.length ? `missing tokens: ${missing.join(", ")}` : "all tokens present" };
    },
  },
  {
    id: "web-wallet-flows",
    component: "dashboard",
    title: "wallet buy and refund flows are wired",
    run: (root) => {
      const files = walk(join(root, "packages/web")).filter((f) => /\.tsx?$/.test(f));
      const src = files.map((f) => readFileSync(f, "utf8")).join("\n");
      const ok = /buyTicket/.test(src) && /refundTicket/.test(src) && /explorer\.solana\.com|solscan|explorer/.test(src);
      return { ok, detail: ok ? "buyTicket, refundTicket and explorer links present" : "flows missing" };
    },
  },

  // ---------- user experience (qa/src/ui-bot.ts) ----------
  ...UI_CHECKS.map(
    (c): CheckDef => ({
      id: c.id,
      component: "ux",
      title: c.title,
      command: "npx tsx qa/src/ui-bot.ts",
      run: async (root) => {
        const r = (await uiBot(root)).find((x) => x.id === c.id);
        return r ? { ok: r.ok, detail: r.detail } : { ok: false, detail: "did not run" };
      },
    })
  ),

  // ---------- world ----------
  {
    id: "world-data",
    component: "world",
    title: "venues.json is valid: >= 2 venues per city, coordinates in range, real-venue disclaimer",
    critical: true,
    run: (root) => {
      const p = join(root, "data/venues.json");
      if (!existsSync(p)) return { ok: false, detail: "data/venues.json missing" };
      const d = JSON.parse(readFileSync(p, "utf8")) as { disclaimer?: string; cities: { name: string }[]; venues: { city: string; lat: number; lng: number; capacity: number }[] };
      const per = new Map<string, number>();
      for (const v of d.venues) per.set(v.city, (per.get(v.city) ?? 0) + 1);
      const short = d.cities.filter((c) => (per.get(c.name) ?? 0) < 2).map((c) => c.name);
      const bad = d.venues.filter((v) => !(v.lat > 41 && v.lat < 56 && v.lng > -6 && v.lng < 25 && v.capacity > 50 && v.capacity < 20000));
      const ok = short.length === 0 && bad.length === 0 && !!d.disclaimer && d.cities.length >= 30;
      return { ok, detail: `${d.cities.length} cities, ${d.venues.length} venues; short: ${short.join(",") || "none"}; out of range: ${bad.length}` };
    },
  },
  {
    id: "world-tests",
    component: "world",
    title: "world generator tests pass (100 unique bands, 100 crew per city, deterministic)",
    command: "npm test -w @greenroom/world",
    run: (root) => {
      const r = sh("npm", ["test", "-w", "@greenroom/world"], root);
      const passed = Number(/# pass (\d+)/.exec(r.out)?.[1] ?? 0);
      return { ok: r.ok && passed >= 3 && !/fail [1-9]/.test(r.out), detail: tail(r.out, 500) };
    },
  },
  {
    id: "world-no-real-bands",
    component: "world",
    title: "generated band names are invented (word-bank combinations only)",
    run: (root) => {
      const names = readFileSync(join(root, "packages/world/src/names.ts"), "utf8");
      const ok = /BAND_ADJ/.test(names) && /BAND_NOUN/.test(names) && /BAND_PATTERNS/.test(names);
      return { ok, detail: ok ? "names are generated from word banks" : "word banks missing" };
    },
  },

  // ---------- docs ----------
  {
    id: "docs-readme",
    component: "docs",
    title: "README has a one-paragraph pitch, quick start, architecture and demo sections",
    critical: true,
    run: (root) => {
      const p = join(root, "README.md");
      if (!existsSync(p)) return { ok: false, detail: "README.md missing" };
      const s = readFileSync(p, "utf8");
      const need = [/quick ?start/i, /architecture/i, /demo/i, /devnet/i, /## /];
      const missing = need.filter((n) => !n.test(s));
      return { ok: missing.length === 0 && s.length > 1500, detail: missing.length ? `missing sections: ${missing.map(String).join(", ")}` : `ok (${s.length} chars)` };
    },
  },
  {
    id: "docs-set",
    component: "docs",
    title: "spec, plan, rubric, design and demo script exist",
    run: (root) => {
      const files = ["docs/00-kickoff.md", "docs/01-program-spec.md", "docs/02-plan.md", "docs/03-qa-rubric.md", "docs/DESIGN.md", "docs/04-demo-script.md", "docs/05-architecture.md"];
      const missing = files.filter((f) => !existsSync(join(root, f)));
      return { ok: missing.length === 0, detail: missing.length ? `missing: ${missing.join(", ")}` : "all present" };
    },
  },
  {
    id: "docs-env-example",
    component: "docs",
    title: ".env.example documents every variable used",
    run: (root) => {
      const p = join(root, ".env.example");
      if (!existsSync(p)) return { ok: false, detail: ".env.example missing" };
      const s = readFileSync(p, "utf8");
      const need = ["ANTHROPIC_API_KEY", "GREENROOM_RPC_URL", "GREENROOM_BRAIN"];
      const missing = need.filter((n) => !s.includes(n));
      return { ok: missing.length === 0, detail: missing.length ? `missing: ${missing.join(", ")}` : "ok" };
    },
  },

  // ---------- devex ----------
  {
    id: "devex-scripts",
    component: "devex",
    title: "root scripts: build:program, test:program, demo, deploy:devnet, qa",
    run: (root) => {
      const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts: Record<string, string> };
      const need = ["build:program", "test:program", "demo", "deploy:devnet", "qa"];
      const missing = need.filter((n) => !pkg.scripts[n]);
      return { ok: missing.length === 0, detail: missing.length ? `missing: ${missing.join(", ")}` : "ok" };
    },
  },
  {
    id: "devex-lockfiles",
    component: "devex",
    title: "Cargo.lock and package-lock.json are present and not ignored",
    run: (root) => {
      const ok = existsSync(join(root, "Cargo.lock")) && existsSync(join(root, "package-lock.json")) && !fileHas(root, ".gitignore", /^(Cargo\.lock|package-lock\.json)$/m);
      return { ok, detail: ok ? "ok" : "lockfile missing or ignored" };
    },
  },
  {
    id: "devex-no-secrets",
    component: "devex",
    title: "no API keys or private keys committed",
    critical: true,
    run: (root) => {
      const files = walk(root).filter((f) => !/\.(so|png|jpg|lock)$/.test(f) && !/package-lock\.json$/.test(f) && statSync(f).size < 2_000_000);
      const hits: string[] = [];
      for (const f of files) {
        const s = readFileSync(f, "utf8");
        if (/sk-ant-[A-Za-z0-9_-]{20,}/.test(s)) hits.push(f + " (anthropic key)");
        if (/-keypair\.json$/.test(f) || (/^\[\s*\d+(\s*,\s*\d+){63}\s*\]/.test(s.trim()) && !f.includes("qa"))) hits.push(f + " (keypair)");
      }
      return { ok: hits.length === 0, detail: hits.join("; ") || "clean" };
    },
  },
  {
    id: "devex-setup-doc",
    component: "devex",
    title: "setup script exists for Windows and Unix",
    run: (root) => {
      const ok = existsSync(join(root, "scripts/setup.ps1")) && existsSync(join(root, "scripts/setup.sh"));
      return { ok, detail: ok ? "ok" : "scripts/setup.ps1 or scripts/setup.sh missing" };
    },
  },
];
