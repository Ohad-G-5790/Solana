# Greenroom

**Tours that book themselves, with the deal on Solana.**

Live: [dashboard](https://ohad-g-5790.github.io/Solana/) · [program on devnet](https://explorer.solana.com/address/4KSaYomRjbnijK1yAELZEGFMPsoPE6u7unY2T6mASUT8?cluster=devnet) · [source](https://github.com/Ohad-G-5790/Solana)

[![ci](https://github.com/Ohad-G-5790/Solana/actions/workflows/ci.yml/badge.svg)](https://github.com/Ohad-G-5790/Solana/actions/workflows/ci.yml) [![program](https://github.com/Ohad-G-5790/Solana/actions/workflows/program.yml/badge.svg)](https://github.com/Ohad-G-5790/Solana/actions/workflows/program.yml) [![pages](https://github.com/Ohad-G-5790/Solana/actions/workflows/pages.yml/badge.svg)](https://github.com/Ohad-G-5790/Solana/actions/workflows/pages.yml)

Every band, venue, fan and crew member has an AI agent. A band's agent takes a brief ("November, Central Europe, eight shows, we draw 400"), negotiates with venue agents, plans a route that makes geographic sense, and opens ticket sales months early. Fans pay into an on-chain escrow per show. Each show carries a sell-through threshold and a deadline: hit it and the show is confirmed; miss it and every fan is refunded automatically. After the show date the escrow is split between the band, the venue and the crew the band hired. No booker, no promoter, no deposit risk, and the band's settled shows become a track record that venues can verify on-chain.

Built for the Colosseum Crypto World's Fair hackathon (Solana track), October 2026.

## What is in the box

| Part | Where | Status |
|---|---|---|
| Anchor program: profiles, tours, shows with escrow vaults, tickets, threshold/refund/settlement cranks, crew payees | `programs/greenroom` | 11 instructions, 13 integration tests on a local validator; deployed on devnet |
| Agents: band, venues, fans, crew, crank, message bus, pluggable brain (heuristic or Claude) | `packages/agents` | end-to-end demo on localnet and devnet |
| Seed world: 136 real venues in 35 cities across DE/AT/FR/PL/CZ, 100 generated bands, 100 crew and 60 fans per city | `packages/world`, `data/venues.json` | deterministic |
| Dashboard: route, show cards with threshold progress, live agent feed, wallet buy/refund, band track record | `packages/web` | Next.js, design per `docs/DESIGN.md` |
| QA bot: automated checks + rubric judge, weighted score, pass at 8.5, five-loop limit | `qa/` | `npm run qa` |

## Quick start

Requirements: Node 20.18+, Rust 1.89+, Solana CLI 4.x, Anchor CLI 1.2.1. Windows users: see the note below.

```bash
git clone https://github.com/Ohad-G-5790/Solana.git greenroom && cd greenroom
bash scripts/setup.sh                 # Windows: powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
npm run test:program                  # program tests on a local validator (~2 min)
npm run demo:fast -- --keep           # agents book a tour end to end on a local validator (~4 min), validator stays up
npm run dev -w @greenroom/web         # dashboard (reads devnet by default; see below for the local validator)
```

`npm run demo:fast` prints the whole negotiation (offers, route, proposals, acceptances, fans buying, cancellations, refunds, crew hires, settlements) and writes `data/runs/<id>/transcript.jsonl` plus `summary.json`, which the dashboard reads. To watch a local run in the dashboard, copy `packages/web/.env.local.example` to `packages/web/.env.local` so it reads the local validator; without that file it reads devnet, where the program is deployed, and shows the recorded run from `packages/web/public/demo`.

### Devnet

Deploying costs about 2.1 SOL of rent for the 300 KB program plus under 1 SOL for a demo run (tickets are 0.001 SOL on public clusters). With a funded wallet:

```bash
solana config set --url devnet
npm run deploy:devnet
npm run demo:devnet -- --shows 8 --history
```

The public devnet RPC rate-limits bursts, so the agents slow down off-localnet (one transaction at a time, short pauses) and retry transient errors; a run of 8 shows takes about 10 minutes there. A free Helius, RPC Fast or FluxRPC endpoint in `GREENROOM_RPC_URL` removes most of the waiting. Budget: about 0.003 SOL per simulated ticket (price plus the ticket account's rent, paid by the hub wallet) and 0.003 SOL per venue, so a full 136-venue, 8-show run needs roughly 1 SOL.

The program is deployed on devnet as `4KSaYomRjbnijK1yAELZEGFMPsoPE6u7unY2T6mASUT8` ([explorer](https://explorer.solana.com/address/4KSaYomRjbnijK1yAELZEGFMPsoPE6u7unY2T6mASUT8?cluster=devnet), deployed 2026-10-08, slot 508938533, tx `2RJsTWwsfgLoxCSgZWd4Mk4GamF3wUCE5btCHAv9ywCrX5P8fELyNyPTDhjoTdNFrcWVQikGta5PEdaYPLTPwYNY`).

### Letting the agents think with Claude

Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY` (a Claude Console key, not a subscription login). The demo CLI loads `.env` from the repo root. The band agent, venue agents and crew hiring then use Claude for their decisions; the deterministic planner always runs first and validates every model answer. Without a key everything runs in heuristic mode, which is also what the tests and the QA bot use.

## How a tour happens

1. The band agent broadcasts a brief with its on-chain track record.
2. Venue agents in the requested countries answer with offers (capacity, share, minimum price, free days) or decline.
3. The band agent plans the route (best offer per city, nearest-neighbour + 2-opt, rest days) and proposes shows on-chain.
4. Venue agents check each proposal against their offer and sign `accept_show`.
5. Fan agents buy tickets into each show's vault; a real wallet can buy from the dashboard too.
6. The crank confirms shows that reach the threshold and cancels the ones that miss the deadline; cancelled shows are refunded ticket by ticket.
7. Crew agents pitch on confirmed shows; the band adds the ones it hires as payees.
8. After the show date the crank settles: vault split by bps, band's track record updated.

Full spec: [docs/01-program-spec.md](docs/01-program-spec.md). Architecture: [docs/05-architecture.md](docs/05-architecture.md).

## Repository layout

```
programs/greenroom/     Anchor program (Rust)
tests/                  program integration tests (mocha, local validator)
packages/sdk            TypeScript client, PDAs, vendored IDL
packages/world          real venues + generated bands, crew, fans
packages/agents         agents, brain, planner, crank, orchestrator, CLI
packages/web            Next.js dashboard
qa/                     QA bot (checks, rubric, reports)
scripts/                setup, local validator, test and demo runners
data/                   venues.json, generated runs
docs/                   kickoff, spec, plan, QA rubric, design system, demo script, architecture
```

## QA gate

`npm run qa` runs every automated check (build, clippy, program tests, agents unit + end-to-end, dashboard build/typecheck/lint/design tokens, world data, docs, developer experience), merges rubric judge scores from `qa/judge/*.json`, and writes `qa/reports/latest.md`. Each part is scored 1–10, the overall score is weighted, **8.5 passes**, and the bot stops after the fifth failed loop. `qa/reports/latest.md` and `qa/state.json` are kept in the repo so the loop history is visible.

## Hosting the dashboard

The dashboard is published to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`: https://ohad-g-5790.github.io/Solana/ . That build is a static export (`npm run build:static -w @greenroom/web`) that reads live account state from devnet and the recorded run bundled in `packages/web/public/demo`. To publish a new devnet run, copy its `summary.json` and `transcript.jsonl` over the bundled ones and push.

Honest note on the bundled run: as of 2026-10-08 it is a three-show devnet tour in which every show was cancelled and refunded, because the demo's hub wallet ran out of devnet SOL mid-sale. The cancellations and refunds are real transactions; a funded eight-show run with confirmed and settled shows replaces it as soon as the faucet allows (the full local run is what the videos show).

The same app also runs as a Node server (`npm run dev` / `next build`) with API routes that read `data/runs`; on Vercel set the root directory to `packages/web` and the `NEXT_PUBLIC_*` variables from `.env.example`.

## Continuous integration

Three workflows run on every push to `main`: `ci` (type checks, unit tests, dashboard lint and build on Node), `program` (builds the Anchor program, runs the 13 integration tests and a full agents run on a Linux validator inside the official Anchor 1.2.1 image; the container needs `--security-opt seccomp=unconfined` because the Agave 4.x validator requires io_uring), and `pages` (publishes the static dashboard).

## Windows note

The Agave 4.x `solana-test-validator` cannot unpack its genesis archive on Windows ("Access is denied"), and `anchor init`/`anchor test` cannot spawn yarn or npm there. This repo works around both: `scripts/local-validator.mjs` starts a Solana 1.18 validator (install once with `agave-install init 1.18.18`, then `agave-install init 4.1.2` to switch back) with the program preloaded, and the program is built for SBPF v0 (`--arch v0`) so that validator can run it. `anchor build` needs `--tools-version v1.54` on Windows because the 4.1 build tool panics for any other platform-tools version. All of this is wired into the npm scripts.

## Roadmap

- USDC (SPL) tickets alongside SOL; Token-2022 compressed tickets as NFTs.
- Dispute window before settlement with a venue check-in signature.
- Dynamic pricing proposals from the band agent based on sell-through.
- Open protocol: any agent framework can speak the bus messages; the program is the contract.

## License

MIT
