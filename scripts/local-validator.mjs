/**
 * Shared helper: start/stop a local solana-test-validator with the Greenroom
 * program preloaded. Used by test-program.mjs and demo-local.mjs.
 *
 * Validator choice (first match wins):
 *   1. env GREENROOM_VALIDATOR
 *   2. on Windows: a Solana 1.18 release under ~/.local/share/solana/install/releases
 *      (the Agave 4.x Windows validator cannot unpack its genesis archive)
 *   3. `solana-test-validator` on PATH
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const isWin = process.platform === "win32";

export function findValidator() {
  if (process.env.GREENROOM_VALIDATOR) return process.env.GREENROOM_VALIDATOR;
  if (isWin) {
    const releases = join(homedir(), ".local", "share", "solana", "install", "releases");
    if (existsSync(releases)) {
      const legacy = readdirSync(releases).filter((d) => d.startsWith("1.18")).sort().reverse();
      for (const rel of legacy) {
        for (const sub of ["solana-release/bin", "bin"]) {
          const bin = join(releases, rel, sub, "solana-test-validator.exe");
          if (existsSync(bin)) return bin;
        }
      }
    }
  }
  return "solana-test-validator";
}

export function programId() {
  const anchorToml = readFileSync(join(root, "Anchor.toml"), "utf8");
  const m = anchorToml.match(/\[programs\.localnet\][^[]*?greenroom\s*=\s*"([^"]+)"/s);
  if (!m) throw new Error("program id not found in Anchor.toml [programs.localnet]");
  return m[1];
}

export function defaultWallet() {
  return process.env.ANCHOR_WALLET ?? join(homedir(), ".config", "solana", "id.json");
}

export function walletPubkey(walletPath) {
  const r = spawnSync(isWin ? "solana-keygen.exe" : "solana-keygen", ["pubkey", walletPath], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

export async function waitForRpc(rpcUrl, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
      });
      const json = await res.json();
      if (json.result === "ok") return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/**
 * Starts the validator and resolves with { rpcUrl, stop() } once RPC is healthy.
 */
export async function startValidator({ rpcPort = Number(process.env.GREENROOM_RPC_PORT ?? 8899), ledger = join(root, ".anchor", "test-ledger"), wallet = defaultWallet(), log = console.log } = {}) {
  const so = join(root, "target", "deploy", "greenroom.so");
  if (!existsSync(so)) throw new Error(`missing ${so}; run: npm run build:program`);
  if (!existsSync(wallet)) throw new Error(`missing wallet ${wallet}; run: solana-keygen new`);
  rmSync(ledger, { recursive: true, force: true });
  mkdirSync(ledger, { recursive: true });

  const bin = findValidator();
  const args = ["--ledger", ledger, "--bind-address", "127.0.0.1", "--rpc-port", String(rpcPort), "--bpf-program", programId(), so, "--reset", "--quiet"];
  const mint = walletPubkey(wallet);
  if (mint) args.push("--mint", mint);
  log(`[validator] starting ${bin}`);
  const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
  let err = "";
  const keep = (d) => {
    err = (err + d.toString()).slice(-4000);
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  let stopping = false;
  child.on("error", (e) => {
    console.error(`[validator] could not start ${bin}: ${e.message}`);
    process.exit(1);
  });
  child.on("exit", (code, signal) => {
    if (!stopping) {
      console.error(`[validator] exited early (code ${code}, signal ${signal}) with args: ${args.join(" ")}\n${err}`);
      // The validator writes its startup errors to files inside the ledger directory.
      for (const name of ["test-ledger-log.txt", "validator.log"]) {
        const p = join(ledger, name);
        if (existsSync(p)) {
          const text = readFileSync(p, "utf8");
          console.error(`--- ${name} (tail) ---\n${text.slice(-3000)}`);
        }
      }
      process.exit(1);
    }
  });
  const rpcUrl = `http://127.0.0.1:${rpcPort}`;
  const ready = await waitForRpc(rpcUrl, 120_000);
  if (!ready) {
    child.kill();
    throw new Error(`[validator] did not become healthy:\n${err}`);
  }
  log(`[validator] ready at ${rpcUrl}`);
  return {
    rpcUrl,
    wallet,
    pid: child.pid,
    stop() {
      stopping = true;
      if (isWin) spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      else child.kill("SIGTERM");
    },
  };
}
