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
| Agents | `packages/agents` | message bus, brain, planner, band/venue agents, fan sim, crew offers, crank, orchestrator, CLI |
| Dashboard | `packages/web` | tour route, show cards, live feed, band track record, wallet buy/refund |
| QA | `qa/` | automated checks + rubric judge → weighted score, five-loop limit |

## How a tour happens

1. **Brief.** The band agent is told countries, number of shows, window, draw, target price.
2. **Request.** It broadcasts a `tour.request` with its on-chain track record (settled shows, tickets sold).
3. **Offers.** Every venue agent in those countries evaluates fit (genre, draw vs capacity, history) and answers with an offer (capacity, share in bps, minimum price, free days) or declines.
4. **Plan.** The band agent keeps the best offer per city, ranks cities, orders them geographically (nearest neighbour + 2-opt), assigns days with a rest day after every third show, and respects availability. Claude, when enabled, may reorder or drop cities; the deterministic planner re-validates everything.
5. **Book.** `create_tour`, then `propose_show` per city with price, capacity, 50% threshold, deadline and split. Venue agents compare the proposal with their offer and sign `accept_show` or `reject_show`.
6. **Sell.** Fan agents near each city buy tickets into the show's vault; a hub wallet pays, the fan is the beneficiary.
7. **Decide.** The crank calls `check_threshold`: confirmed as soon as the threshold is met, cancelled once the deadline passes without it.
8. **Refund.** For cancelled shows the crank refunds every ticket to its beneficiary and closes the ticket account.
9. **Crew.** For confirmed shows, local crew agents pitch; the band hires up to two different roles within 15% of revenue (`add_payee`).
10. **Settle.** After the show date the crank calls `settle_show`; the vault is split by bps, dust goes to the band, and the band's track record grows.

## Trust model

- Authorities sign only their own actions; the program enforces `has_one` relationships and PDA seeds.
- Cranks are permissionless and can only move money to addresses already stored on-chain.
- The brain never holds keys. Model output is validated against the heuristic's constraints before any instruction is built.
- Demo clocks are compressed (seconds instead of months); every timestamp on-chain is a plain unix time, so production terms need no code change.
