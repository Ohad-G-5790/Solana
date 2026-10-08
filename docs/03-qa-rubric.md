# QA bot rubric

The QA bot (`qa/`) scores every part of the system from 1 to 10 and computes a weighted overall score. **Pass = overall ≥ 8.5.** Each run is a loop; on a fail we fix and re-run. **After the 5th failed loop the bot stops regardless of score** and the final report is delivered as is. Loop state lives in `qa/state.json`; reports in `qa/reports/loop-N.json` and `qa/reports/latest.md`.

Per-component score = 0.6 × automated score + 0.4 × judge score. Automated score maps the fraction of passing checks to 1-10 (a failing build caps the component at 3). Judge score comes from a rubric review by a Claude reviewer (Claude Code subagent during development, or `claude -p` from the repo) reading the code and reports; without any reviewer available, the judge score falls back to the automated score so the loop still runs.

| # | Component | Weight | Automated checks | Judge criteria |
|---|---|---|---|---|
| 1 | On-chain program | 25% | `anchor build` ok; `cargo clippy` no errors; all tests pass; every instruction has a happy-path and at least one error-path test; checked math only; no `init_if_needed` | state machine clarity, constraint correctness vs security checklist, event coverage, code organisation |
| 2 | Agents | 25% | end-to-end simulation on localnet completes: ≥ 6 shows proposed and accepted, tickets sold, at least one show cancelled with all refunds, remaining shows settled with correct splits; heuristic mode passes without LLM; LLM adapter unit tests | negotiation quality, route sanity (distance order, no same-day double booking), safety guardrails (no signing outside allowed instructions), logging/transcript quality |
| 3 | Dashboard | 20% | `next build` ok; typecheck ok; lint ok; design tokens match DESIGN.md (colors, pill radius, type scale); phone width has no horizontal scroll; wallet buy and refund flows wired | fidelity to DESIGN.md, information clarity (threshold, deadline, state), live feed usefulness, explorer links |
| 4 | Seed world | 10% | `venues.json` validates; ≥ 2 venues per city, coordinates inside country bounds; 100 bands with unique names; 100 crew per city; fan population generated deterministically | realism and labelling of approximations, no real band names, data loader API |
| 5 | Docs and submission | 10% | README quick start runs on a clean machine (scripted check); spec, plan and architecture present; demo script present; `.env.example` present | clarity for judges in 60 seconds, honesty (no claimed features that don't exist) |
| 6 | Developer experience | 10% | one-command setup and demo scripts succeed on Windows; `npm test` at root runs everything; `Cargo.lock` committed; no secrets in repo (scan) | reproducibility, structure, naming |

Overall = Σ weight × component score. Report lists every failing check with the command to reproduce it.
