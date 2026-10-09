# Greenroom — notes for AI coding agents

Monorepo: Anchor program (`programs/greenroom`), TypeScript workspaces (`packages/sdk`, `packages/world`, `packages/agents`, `packages/web`), QA bot (`qa/`). Read `README.md` first, then `docs/01-program-spec.md` and `docs/05-architecture.md`.

## Commands (run from the repo root)

- `npm run build:program` — `anchor build --tools-version v1.54 --arch v0` + IDL sync into `packages/sdk/idl` and `packages/web/src/idl`. Always rebuild and sync after changing Rust.
- `npm run test:program` — starts a local validator with the program preloaded and runs `tests/greenroom.ts` (~90 s).
- `npm run demo:fast` — full agent run on a local validator (~4 min), auto-pilot approvals. `--keep` leaves the validator up for the dashboard.
- `npm run demo:approve` — same, but the run waits for the band's decisions on the dashboard's Approvals page.
- `npx tsx src/testing/simulate.ts [--approve] [--empty-first]` (in `packages/agents`) — dev aid: one tour on an in-memory fake chain written to `data/runs/`, for working on the dashboard without a validator. Its addresses and signatures exist on no cluster.
- `npm run dev -w @greenroom/web` — dashboard; `packages/web/.env.local` points it at localnet. Band pages need a connected wallet (`components/BandSession.tsx`); the shell loads `lib/greenroom.ts` lazily and `next.config.ts` keeps `@anchor-lang/core` server-external, because Anchor's CommonJS build cannot be bundled for server rendering.
- Agents as your own band: `--band-keypair <file> --band-name ... --genre ... --draw ... --home-city ...` (`keyfile.ts` reads JSON arrays or base58 exports). Never commit key files.
- `npm run typecheck -w <pkg>`, `npm test -w @greenroom/world`, `npm test -w @greenroom/agents`.
- `npm run qa` — the QA bot. Every run counts as a loop; `npm run qa:dry` for a dry run that does not count.
- CI: `.github/workflows/program.yml` is the Linux proof (Anchor 1.2.1 container, seccomp unconfined for io_uring); `ci.yml` is Node-only; `pages.yml` publishes the dashboard. `@anchor-lang/core` is CommonJS: under Node 22 ESM take `BN` from `bn.js`, not from the Anchor namespace.

## Windows specifics (this repo was built on Windows 11 without WSL)

- `anchor build` must get `--tools-version v1.54`; cargo-build-sbf 4.1.0 panics for any other platform-tools version on Windows.
- The Agave 4.x `solana-test-validator` cannot unpack its genesis archive on Windows. `scripts/local-validator.mjs` uses the Solana 1.18 release validator instead, which is why the program is built for SBPF v0.
- `anchor init` / `anchor test` cannot spawn yarn/npm on Windows; tests run through `scripts/test-program.mjs`.
- Workspace `members` must list `programs/greenroom` explicitly; the `programs/*` glob fails on Windows.
- The 1.18 validator's faucet does not work; fund wallets by transfer from the mint wallet (the tests and orchestrator already do).

## Conventions

- Instruction names are `subject_verb_object`-ish and documented in the spec; keep the state machine in `state.rs` explicit.
- Agents never let the model sign: every decision has a heuristic baseline and a `validate` step (`packages/agents/src/brain.ts`).
- Nothing goes on-chain before the band approves the route (`approvals.ts`, `approver.ts`). Modules the dashboard imports (`approvals.ts`, `alternatives.ts`, `planner.ts`, `world/src/geo.ts`) stay pure: no Node APIs.
- `npm test -w @greenroom/agents` includes `orchestrator.test.ts`, which runs whole tours on `src/testing/fake-chain.ts` (~20 s). It mirrors the spec's preconditions but is not the program; `npm run test:program` is.
- Demo clocks are compressed; on-chain timestamps are plain unix seconds.
- The dashboard follows `docs/DESIGN.md`; keep tokens in `globals.css`.
- QA gate: score each part 1–10, overall ≥ 8.5 passes, stop after the fifth failed loop (see `docs/03-qa-rubric.md`).
