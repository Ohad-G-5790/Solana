# Build plan (Oct 8 evening to Oct 12, 11:59pm PT)

## Repository layout (monorepo, npm workspaces)

```
greenroom/   (repository root)
  Anchor.toml  Cargo.toml  rust-toolchain.toml   # Anchor workspace root
  programs/greenroom/                           # on-chain program (Rust, Anchor 1.2.1)
  tests/                                        # program integration tests (mocha + solana-test-validator)
  packages/
    sdk/        # TypeScript client: PDAs, instruction builders, account decoders (Kit + Anchor IDL)
    world/      # seed world: venues.json loader, 100 bands, crew and fan generators (seeded RNG)
    agents/     # band / venue / crew / fan agents, message bus, LLM adapter (Claude Code CLI) + heuristic fallback, crank
    web/        # Next.js dashboard following docs/DESIGN.md
  qa/           # QA bot: automated checks + rubric judge, reports, loop counter
  data/         # venues.json (real venues), generated seed files
  docs/         # kickoff, spec, plan, rubric, design system, submission copy
  scripts/      # setup.ps1 / setup.sh, run-demo, deploy-devnet
```

## Milestones

| When | Milestone | Done means |
|---|---|---|
| Oct 8 night | M0 toolchain + scaffold | Anchor 1.2.1 builds and tests on this machine; repo initialised; CI-less but one-command setup script |
| Oct 9 | M1 program | All 11 instructions, state machine, events, errors; mocha tests for the happy path and every error path; deployed to devnet |
| Oct 9 | M2 world | `data/venues.json` real venues; 100 bands; 100 crew profiles per city; fan population per city; deterministic generator |
| Oct 10 | M3 agents | Band agent plans a route from venue offers; venue agents accept/decline using on-chain track record; fan agents buy; crank confirms/cancels/refunds/settles; crew agents pitch on confirmed shows; whole run on localnet in one command; LLM via Claude Code CLI with heuristic fallback |
| Oct 10-11 | M4 dashboard | Route map, show cards with threshold progress, live agent feed, wallet buy/refund, band track record page; design per DESIGN.md; deployed (Vercel) against devnet |
| Oct 11 | M5 QA + docs | QA bot overall ≥ 8.5 or loop 5 reached; README quick start; architecture doc; demo script; submission copy |
| Oct 12 | M6 submission | Videos recorded by the owner; GitHub public; Colosseum form filled |

## Demo narrative (for the 3-minute video)

1. A band's agent gets a brief: "November, Central Europe, 8 to 10 cities, we draw ~400 people". Its on-chain track record shows last year's settled shows.
2. Venue agents in 30+ cities answer with offers; the band agent picks a route that makes geographic sense and proposes shows on-chain; venue agents accept.
3. Fans (their agents) buy tickets into escrow; the dashboard shows each city racing toward its 50% threshold.
4. Deadline hits: two cities fall short, get cancelled, and every fan is refunded automatically; the rest are confirmed.
5. Crew agents in confirmed cities pitch sound, lights, photo and drivers; the band adds a few as payees.
6. Show dates pass; settlement splits every escrow in one transaction each; the band's track record grows. Everything verifiable on Solana explorer.

## Risks and fallbacks

- No API key: the LLM layer runs through the owner's Claude Code subscription locally; the hosted demo replays a recorded negotiation and reads live on-chain state. Heuristic agents guarantee the pipeline never depends on the LLM.
- Devnet airdrops are rate-limited: fund one treasury wallet via the faucet, and let it pay for simulated fans (`buy_ticket` separates payer from beneficiary).
- Windows: no LiteSVM/Surfpool; tests use `anchor test --validator legacy`. Workspace members are listed explicitly.
