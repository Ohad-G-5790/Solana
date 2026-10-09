# Architecture

```
                 ┌──────────────────────────────────────────────────────────┐
                 │                      Solana (devnet)                      │
                 │  greenroom program: BandProfile · VenueProfile · Tour    │
                 │  Show (+ vault PDA) · Ticket · events                     │
                 └───────▲───────────────▲───────────────▲──────────────────┘
                         │               │               │
          signs as band  │  signs as     │  pays, bene-  │  permissionless
          authority      │  venue auth.  │  ficiary=fan  │  cranks
                         │               │               │
┌────────────────────────┴───┐  ┌────────┴────────┐  ┌───┴────────┐  ┌────────────┐
│ Band agent                 │  │ Venue agents    │  │ Fan sim    │  │ Crank      │
│ brief → request → plan →   │  │ offer / decline │  │ 60 fans    │  │ confirm,   │
│ propose → hire crew        │  │ accept / reject │  │ per city   │  │ cancel,    │
└────────────┬───────────────┘  └────────┬────────┘  └─────┬──────┘  │ refund,    │
             │          message bus (transcript.jsonl)      │         │ settle     │
             └──────────────────────┬────────────────────────┘         └─────┬──────┘
                                    │                                        │
                       ┌────────────┴───────────┐                  ┌─────────┴─────────┐
                       │ Brain (per decision)   │                  │ Dashboard (Next)  │
                       │ heuristic always;      │                  │ reads chain + the │
                       │ Claude refines when a  │                  │ transcript; wallet│
                       │ key is set, validated  │                  │ buy / refund      │
                       └────────────────────────┘                  └───────────────────┘
```

## Layers

| Layer | Package | What it owns |
|---|---|---|
| Program | `programs/greenroom` (Rust, Anchor 1.2.1) | deal terms, escrow, state machine, payouts. Spec: [01-program-spec.md](01-program-spec.md) |
| SDK | `packages/sdk` | PDAs, instruction wrappers, account fetchers, deterministic wallets, vendored IDL |
| World | `packages/world` | `data/venues.json` loader (136 real venues in 35 cities), generators for 100 bands, 100 crew per city, fans per city |
| Agents | `packages/agents` | message bus, brain, planner, band approvals and replacement options, band/venue agents, fan sim, crew offers, crank, orchestrator, CLI |
| Dashboard | `packages/web` | the band's view: approvals, attention list, route with drive times, show health, venue finder, route planner, live feed, track record, wallet buy/refund |
| QA | `qa/` | automated checks + rubric judge → weighted score, five-loop limit; UI bot (Chromium) for the user-experience score |

## How a tour happens

1. **Brief.** The band agent is told countries, number of shows, window, draw, target price.
2. **Request.** It broadcasts a `tour.request` with its on-chain track record (settled shows, tickets sold).
3. **Offers.** Every venue agent in those countries evaluates fit (genre, draw vs capacity, history) and answers with an offer (capacity, share in bps, minimum price, free days) or declines.
4. **Band approves venues.** The band agent publishes an `approval.request` with every offer scored for fit and the drive from home; the planner's picks plus a few backups are recommended. The band answers in the dashboard (or auto-pilot takes the recommendation).
5. **Plan.** From the approved venues only, the band agent keeps the best offer per city, ranks cities, orders them geographically (nearest neighbour + 2-opt), assigns days with a rest day after every third show and a travel day before any leg over 9 hours of driving, and respects availability. Claude, when enabled, may reorder or drop cities; the deterministic planner re-validates everything.
6. **Band approves the route.** A second `approval.request` carries the itinerary, drive per leg, days off and money at threshold and sellout. Dropping stops triggers a re-plan; declining books nothing.
7. **Book.** `create_tour`, then `propose_show` per city with price, capacity, 50% threshold, deadline and split. Venue agents compare the proposal with their offer and sign `accept_show` or `reject_show`.
8. **Sell.** Fan agents near each city buy tickets into the show's vault; a hub wallet pays, the fan is the beneficiary.
9. **Decide.** The crank calls `check_threshold`: confirmed as soon as the threshold is met, cancelled once the deadline passes without it.
10. **Refund and replace.** For cancelled shows the crank refunds every ticket to its beneficiary and closes the ticket account. The band agent offers up to three replacements from approved venues (same venue at half the capacity, a smaller room in the same city, a nearby city within 250 km of extra driving) without pausing the other shows; the band's pick is proposed as a new show with its own deadline and linked to the cancelled one. One replacement per date.
11. **Crew.** For confirmed shows, local crew agents pitch; the band hires up to two different roles within 15% of revenue (`add_payee`).
12. **Settle.** After the show date the crank calls `settle_show`; the vault is split by bps, dust goes to the band, and the band's track record grows.

## Booking from the browser

The hosted dashboard is static, so a band books without any server of ours:

| Piece | Where | Role |
|---|---|---|
| Four answers → plan | `packages/web/src/lib/book.ts` `planFromAnswers` | runs the venue offer heuristic (`packages/agents/src/offers.ts`, pure) for every registered seed venue, then the planner; the route preview is the band's approval |
| Venue keys | `packages/web/public/venue-profiles.json` (regenerate with `npx tsx src/export-venue-profiles.ts` in `packages/agents`) | venue id → authority and profile PDA, so the browser never scans program accounts |
| Book | `bookTour` | `create_tour` plus one `propose_show` per stop, packed into as few transactions as fit, signed in one wallet prompt |
| Keeper | `packages/agents/src/keeper.ts`, `.github/workflows/keeper.yml` | every 10 minutes on Actions: registers missing seed venues, answers proposed shows with the seed venue keys (deterministic, demo only) using the venue offer rule: share, price, capacity, threshold, no double booking (`venueTermsProblems`), simulates fans only for fair shows and within a per-band budget, runs the crank (confirm, cancel, refund, settle); pauses fans when the demo wallet runs low |

The keeper holds only the demo wallet (an Actions secret) and the seed venues' deterministic demo keys; it never holds a band's key. Everything it does besides accepting is a permissionless crank.

## Band approvals

| Piece | Where | Role |
|---|---|---|
| Request and answer types, builders, validation, transcript reader | `packages/agents/src/approvals.ts` | pure, also imported by the dashboard |
| Replacement options | `packages/agents/src/alternatives.ts` | pure |
| Auto-pilot and dashboard approvers | `packages/agents/src/approver.ts` | `AutoApprover` answers with the recommendation; `FileApprover` polls `decisions.jsonl` in the run folder |
| Decision endpoint | `packages/web/src/app/api/approvals/route.ts` | validates the answer against the pending request and appends it to `decisions.jsonl` |
| Drive estimates and stop ordering | `packages/world/src/geo.ts` | pure, shared by planner and dashboard |

Requests and decisions are ordinary bus messages (`approval.request`, `approval.decision`), so they appear in the transcript and the feed. The band never signs through the dashboard: the agent holds the band's key, and an answer only selects among options the agent computed.

## Trust model

- Authorities sign only their own actions; the program enforces `has_one` relationships and PDA seeds.
- Cranks are permissionless and can only move money to addresses already stored on-chain.
- The brain never holds keys. Model output is validated against the heuristic's constraints before any instruction is built.
- Demo clocks are compressed (seconds instead of months); every timestamp on-chain is a plain unix time, so production terms need no code change.
