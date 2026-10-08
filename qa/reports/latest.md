# QA report — loop 3 — overall **9.40 / 10** — PASS (pass ≥ 8.5)

| Component | Weight | Automated | Judge | Score |
|---|---|---|---|---|
| On-chain program | 0.25 | 10 | 9 | **9.6** |
| Agents | 0.25 | 10 | 8.3 | **9.3** |
| Dashboard | 0.2 | 10 | 8.6 | **9.4** |
| Seed world | 0.1 | 10 | 8.5 | **9.4** |
| Docs and submission | 0.1 | 10 | 8.6 | **9.4** |
| Developer experience | 0.1 | 10 | 7.8 | **9.1** |

## Checks

### On-chain program
Judge: One file per instruction, an explicit five-state machine, every authority a Signer bound by has_one or seeds+stored bump, no init_if_needed, checked lamport/bps math, a system-PDA vault with a rent float so PDA-signed transfers never break rent, settlement that checks each remaining account against the stored payee list in order, and all 12 events emitted. The previous blocking gap is closed: buy_ticket.rs:42-44 refuses purchases on an OnSale show once threshold_deadline has passed (SalesClosed), so an undecided show cannot be rescued late, and the clippy range lint is fixed. tests/greenroom.ts now covers 13 cases with about 25 error-code assertions including reject_show from a stranger (244-251), a real check_threshold TooEarly before deadline2 (298-300), the late-purchase SalesClosed path (383), rent/float accounting, split rounding and PayeeMismatch, with waits on the chain clock. Remaining items are small: an unchecked multiply in threshold_met, a misleading error label on the ticket/show has_one, no way to reclaim the vault float or Show rent after a terminal state, and a few untested error codes.

- ✅ program-build: anchor build succeeds (SBPF v0, platform-tools v1.54) (critical)
- ✅ program-clippy: cargo clippy reports no errors
- ✅ program-tests: integration tests pass on a local validator (critical)
- ✅ program-error-paths: every instruction has a happy-path and an error-path test
- ✅ program-safety: no init_if_needed, checked math on lamports, PDA-signed transfers

### Agents
Judge: Well-structured: a message bus whose transcript is the dashboard feed, a brain that always computes the heuristic first and validates any model answer before an instruction is built (it holds no keys; ClaudeBrain's success, bad-JSON, API-error and rejected-answer paths are now unit-tested with an injected client), a planner with best-offer-per-city scoring, nearest-neighbour + 2-opt routing, rest days and venue availability, and a crank limited to the three permissionless instructions with payees taken from the stored account. The orchestrator now subscribes to accept/reject before proposing, takes the live show list from chain state, chunks getMultipleAccountsInfo, batches venue funding, and the fan population scales with city population, so the headline path finally shows in the default demo: the two latest runs booked 8/8 shows on sane 1600-2000 km routes and produced 1 and 2 natural cancellations with every ticket refunded, the rest settled with crew payees; qa/src/checks.ts:151 now requires it. Remaining gaps: negotiation is single-shot and in heuristic mode a venue rejection is structurally impossible (rejected: 0 in every run although docs describe accept/reject), validate() leaves offeredCapacity/minPriceLamports unchecked for type and sign, crew.hired messages duplicate their reasoning text, and the history tour's 4-second deadline will likely cancel before fans buy.

- ✅ agents-typecheck: agents and sdk packages type-check (critical)
- ✅ agents-unit: planner, brain and bus unit tests pass
- ✅ agents-e2e: end-to-end demo on a local validator: shows booked, tickets sold, at least one cancellation fully refunded, settlements done (critical)
- ✅ agents-guardrails: LLM answers are validated and never sign; heuristic path has no network dependency

### Dashboard
Judge: High fidelity to DESIGN.md: the tokens in globals.css match the spec (near-black surfaces, single #1ed760 accent, silver text, heavy/medium shadows, inset input border), buttons are 9999px pills with uppercase 1.4px tracking, inputs are 500px pills, badges 2px capitalised 10.5px, cards borderless with hover lift, type stays in the 10-24px range, and the sidebar collapses to a scrollable top nav under 896px with the wallet button kept on one line. Show cards and the show page make threshold, deadline and state clear (sold/need, threshold tick, chain-clock countdowns, split and crew labels), the feed polls the transcript every 2 s with tx explorer links, buy/refund/check-threshold are wired to a real wallet, server-data.ts prefers the newest run folder, and the previous blockers are fixed: a recorded run is bundled in public/demo and the show and band pages now render an 'RPC unreachable' message instead of hanging. Remaining: the bundled localnet run's explorer links go to devnet on a hosted build (dead links until the devnet deploy), the home page swallows RPC errors silently, flavour dates sit beside second-level countdowns without a 'demo clock' label, accent green is used as a background on the settled badge and brand dot, and tables have no overflow wrapper.

- ✅ web-build: next build succeeds (critical)
- ✅ web-typecheck: web package type-checks and lints
- ✅ web-design-tokens: design tokens follow docs/DESIGN.md (near-black surfaces, #1ed760 accent, pill radius)
- ✅ web-wallet-flows: wallet buy and refund flows are wired

### Seed world
Judge: Honest, well-labelled seed data: a file-level disclaimer, a per-venue source (51 of 136 openly marked 'model knowledge'), notes, website and geo_precision on every record; 136 venues in 35 cities with at least three per city; a seeded mulberry32 RNG with SHA-256-derived wallet seeds makes venues, bands, crew and fans fully deterministic (verified by the test); fan counts scale with city population via fansForCity, which is what now produces natural cancellations in the demo; the loader API (loadVenueFile, generateWorld, distanceKm, fansForCity, typed World/Venue/Band/CrewProfile/FanProfile) is small and ergonomic. A REAL_BAND_BLOCKLIST now skips known real acts, but it is hand-picked and still misses combinations flagged last time (Hungry Ghosts) and others the word banks can form (Lost Horizon); loadVenueFile still validates only the two top-level arrays; and the README's '60 fans per city' is a base, not a per-city count.

- ✅ world-data: venues.json is valid: >= 2 venues per city, coordinates in range, real-venue disclaimer (critical)
- ✅ world-tests: world generator tests pass (100 unique bands, 100 crew per city, deterministic)
- ✅ world-no-real-bands: generated band names are invented (word-bank combinations only)

### Docs and submission
Judge: A judge gets the product in one paragraph, the 'what is in the box' table, quick start, 'how a tour happens', repository layout, QA gate and Windows note are clear, and the honesty problems from the last review are fixed: the README no longer claims a live devnet deployment (status 'pending funding', explained in the Devnet section and tracked in docs/06-submission.md), the .env flow is real (cli.ts loads it) and the `--keep` + .env.local dashboard flow is documented and scripted, and docs/01-program-spec.md now matches the code field for field (Greenroom, buy_ticket(quantity, beneficiary), the SalesClosed rule, the full error list, a test-coverage section I checked against tests/greenroom.ts). Submission copy, presentation and demo scripts, architecture, plan, rubric and design system are all present, plus LICENSE and CLAUDE.md. Remaining honesty nits: README:14 still says the agents demo runs 'on localnet and devnet' although the program has never been deployed there, the '60 fans per city' phrasing, docs/02-plan.md and docs/00-kickoff.md still describe the LLM adapter as the Claude Code CLI with no API key, and the only QA report in the repo predates the fixes and shows a FAIL.

- ✅ docs-readme: README has a one-paragraph pitch, quick start, architecture and demo sections (critical)
- ✅ docs-set: spec, plan, rubric, design and demo script exist
- ✅ docs-env-example: .env.example documents every variable used

### Developer experience
Judge: Setup is one command on both OSes and the scripts now also create packages/web/.env.local; scripts/local-validator.mjs hides the Windows 1.18 / SBPF-v0 workaround cleanly, root `npm test` runs the program tests plus every workspace, demo-local.mjs supports --keep, the agents CLI loads <repo>/.env without a dependency, a GitHub Actions workflow runs the Node-side typecheck/tests/lint/build, LICENSE and CLAUDE.md exist, Cargo.lock and package-lock.json exist, .env/.env.local/data/runs are ignored, QA reports are tracked, and no secrets are present (packages/web/.env.local holds only public localnet values). The hard gap is unchanged and scored as such: the repository has zero commits, so 'lockfiles committed' and the README's git clone are not yet true, and deploy:devnet has never run (the wallet holds 0.025 SOL against ~2.5 needed). Smaller leftovers: the empty migrations/ scaffold, the inline `node -e` sync:idl, no root qa:quick alias, an unexplained .local/ folder, and a stale failing QA report.

- ✅ devex-scripts: root scripts: build:program, test:program, demo, deploy:devnet, qa
- ✅ devex-lockfiles: Cargo.lock and package-lock.json are present and not ignored
- ✅ devex-no-secrets: no API keys or private keys committed (critical)
- ✅ devex-setup-doc: setup script exists for Windows and Unix
