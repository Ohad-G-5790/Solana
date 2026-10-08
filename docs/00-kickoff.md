# Kickoff: AI-agent self-booking concert tours on Solana

Working name: **Greenroom** (the backstage room where band, venue and crew meet before a show; alternatives: Circuit, Backline). "Roadie" was rejected as too generic; the name must say "a hub that connects". Written 2026-10-08, updated the same evening with the owner's decisions.

## Hackathon facts (Colosseum Crypto World's Fair, Solana track)

- Contest period: 6:00am PT Sep 14 to **11:59pm PT Oct 12, 2026**. Winners by Dec 5, 2026.
- Judging criteria from the official rules: functionality and code quality, potential impact, novelty, UX, open-source and composability, business plan.
- Submission portal asks for: name, description, chains and tools, team with backgrounds and location, logo, public GitHub repo (or access for hackathon@colosseum.com), a 2-3 minute presentation video, a product demo video of at most 3 minutes, and go-to-market, demand validation and distribution notes.
- Only work done inside the contest period counts; pre-existing work must be disclosed. One team, one product.
- Solana track: $100k across 10 products; grand champion $30k; 20 standout teams $15k each.

## Decisions taken on 2026-10-08

| Topic | Decision |
|---|---|
| LLM access | No API key at kickoff, Claude subscription only. Anthropic's terms do not allow app agents on a subscription login, so the agents use a Claude Console API key when one is set and a deterministic heuristic brain otherwise (what tests, QA and the recorded runs use). |
| Currency | SOL |
| Deal terms | 50% threshold, deadline before the show, band 70 / venue 30, permissionless cranks |
| Proof of past concerts | On-chain track record. Seed world: 100 bands, real venues in major cities of Germany, Austria, France, Poland and Czechia (`data/venues.json`, capacities approximate) |
| Frontend | Full dashboard following `docs/DESIGN.md` (Spotify-inspired dark system) |
| Crew layer | In scope: 100 fake crew profiles per city; their agents pitch services to the band on confirmed shows; the band can add them as payees |
| Fans | Simulated fan population per city with wallets, plus a real wallet buy button |

## The idea in one paragraph

Every band, venue and fan has an AI agent. A band's agent is told "November, Europe, these cities, this capacity, here is our track record". It talks to venue agents, collects offers, plans a route that makes geographic and financial sense, and opens ticket sales months early. Fans (or their agents) pay in crypto into an on-chain escrow per show. Each show carries a sell-through threshold and a deadline. If the threshold is not met by the deadline the show is cancelled on-chain and every fan is refunded automatically. If it is met, the show goes ahead and after the show date the escrow is split between the band and the venue (and later: bus driver, sound engineer, photographer, session players). No booker, no promoter, no deposit risk.

## Why Solana

- Escrow, threshold check, refund and payout are all small, cheap, parallel transactions: thousands of fans buying tickets is fine.
- The program's own settled-show history becomes the band's verifiable "proof of past concerts" that venue agents can trust without a middleman.
- Agents can act with their own wallets, so negotiation and settlement are machine-to-machine end to end.

## Proposed architecture (MVP for the hackathon)

### 1. On-chain program (Anchor, devnet)

Accounts (all PDAs):

| Account | Seeds | Holds |
|---|---|---|
| `BandProfile` | `["band", authority]` | name, shows completed, tickets sold total (the on-chain track record) |
| `VenueProfile` | `["venue", authority]` | name, city, lat/lng, capacity |
| `Tour` | `["tour", band, tour_id]` | name, region, date window, status |
| `Show` | `["show", tour, venue, date]` | ticket price, capacity, threshold (bps), threshold deadline, show date, payout split (bps per party), state, tickets sold, vault |
| `Ticket` | `["ticket", show, buyer, n]` | buyer, amount paid, refunded flag |

Instructions:

1. `register_band`, `register_venue`
2. `create_tour` (band agent)
3. `propose_show` (band agent) then `accept_show` (venue agent signs) → show is on sale
4. `buy_ticket` (fan pays into the show's vault PDA)
5. `check_threshold` (anyone, after the deadline): below threshold → `Cancelled`, else → `Confirmed`
6. `refund_ticket` (anyone, only when `Cancelled`): sends the fan their money back
7. `settle_show` (anyone, after the show date, only when `Confirmed`): splits the vault by the stored bps and bumps the band's track record
8. Stretch: `add_payee` so crew/service providers get a slice of the split

State machine: `Proposed → OnSale → (Confirmed | Cancelled) → Settled`.

### 2. Agents (TypeScript, Claude API)

- **Band agent**: takes the brief (dates, region, cities, capacity, budget), broadcasts a tour request, scores venue offers (fit, price, distance to the previous city, rest days), picks a route, proposes shows on-chain, and later reports which cities sold best.
- **Venue agents**: one per venue, each with its own wallet and a persona (capacity, calendar, minimum fee or split). They read the band's on-chain track record, make or decline offers, and sign `accept_show`.
- **Fan agents**: a crowd of simulated wallets with city and genre preferences that buy tickets over simulated time, so the demo shows thresholds being hit or missed.
- **Crank**: a tiny scheduler that calls `check_threshold`, `refund_ticket` and `settle_show` when time conditions are met.
- Negotiation runs over a small in-process message bus with a transcript log that the dashboard streams live.

### 3. Dashboard (Next.js + Solana Kit wallet)

- Map/route view of the tour, one card per show with progress bar (sold / threshold / deadline), escrow balance, state badge.
- Live agent negotiation feed.
- "Buy ticket" with a real wallet (Phantom etc.) on devnet, plus "Refund" when a show is cancelled.

### 4. QA bot (required gate)

A `qa/` harness that runs every component check (build, program tests, agent end-to-end simulation, typecheck, lint, frontend build, docs) and a rubric-based Claude reviewer that scores each part 1-10 and computes a weighted overall score. Pass is **8.5 or higher**. On a fail we fix and loop; after the **5th failed loop we stop** regardless of score and report. Reports are saved per loop in `qa/reports/`.

## Toolchain on this machine (updated 2026-10-08 evening)

The versions that were installed (Anchor 0.30.1, Solana CLI 1.18.18, Rust 1.81) could not build even an empty program anymore: current crates require Cargo's 2024 edition, which that two-year-old toolchain cannot parse, and pinning crates one by one was a losing game. So the machine was moved to the stack the official Solana skill recommends.

| Tool | Before | Now | Note |
|---|---|---|---|
| Rust | 1.81 | 1.99 stable | `rustup update stable` |
| Solana CLI | 1.18.18 | 4.1.2 (Agave) | installed side by side via `agave-install`; switch back with `agave-install init 1.18.18` |
| platform-tools (SBF compiler) | v1.41 (Rust 1.75) | v1.54 (Rust 1.89) | Windows build available |
| Anchor CLI | 0.30.1 | 1.2.1 | built from source with `cargo install --git https://github.com/otter-sec/anchor --tag v1.2.1 anchor-cli` |
| Node | 24 | 24 | ok |
| WSL | broken | broken | Windows-native tooling only |
| Test runner | | `solana-test-validator` 4.1.2 | verified it starts and answers RPC on this machine; LiteSVM and Surfpool have no Windows binaries |
| Dev wallet | none | `~/.config/solana/id.json`, address `3Aon5LFqG7y9Q1fdqMhMDctxFwxFtvGcZvnTfseHvJcz` | devnet airdrop was rate-limited; use https://faucet.solana.com |

Two Windows quirks to bake into the repo: list the program explicitly in the workspace `members` instead of `programs/*` (cargo cannot expand that glob on Windows), and always commit `Cargo.lock`.

## Open questions (answered defaults in bold)

1. Which hackathon, exact deadline and timezone, and what must be submitted (repo, demo video, pitch deck, live link, track)?
2. Do we have an Anthropic API key for the agents? **Answered: no key yet; the agents run on the heuristic brain and switch to Claude when a Console key is set.**
3. Ticket currency: **SOL for the MVP**, devnet USDC as a stretch.
4. Default deal terms: **threshold 50%, deadline 30 days before the show (compressed in the demo), split band 70 / venue 30, anyone can crank refunds and settlement once time conditions are met.**
5. Proof of past concerts: **on-chain track record from settled shows, seeded for the demo band.** Off-chain proof links as a stretch.
6. Frontend: **full dashboard with wallet buy button.**
7. Crew/service-provider layer: **designed into the split list from day one, UI only if time allows.**
8. Project name: decided later the same day: **Greenroom** ("Roadie" was rejected as too generic).
