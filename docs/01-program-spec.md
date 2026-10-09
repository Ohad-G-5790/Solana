# Greenroom on-chain program spec (Anchor 1.2.1)

Program name: `greenroom`, id `4KSaYomRjbnijK1yAELZEGFMPsoPE6u7unY2T6mASUT8`. One program, lamports (SOL) as the ticket currency for the MVP. This document matches `programs/greenroom/src`.

## State machine

```
Proposed --accept_show (venue)--> OnSale --check_threshold--> Confirmed --settle_show (after show date)--> Settled
   |                                 |
   +--reject_show (venue)--> closed  +--check_threshold (deadline passed, below threshold)--> Cancelled --refund_ticket (per ticket)
```

`check_threshold` confirms **as soon as** the threshold is met (even before the deadline) and cancels only when the deadline has passed and the threshold is not met. Any other call returns `TooEarly`.

## Accounts (all PDAs, canonical bump stored)

| Account | Seeds | Fields |
|---|---|---|
| `BandProfile` | `["band", authority]` | `authority`, `name` (≤32), `genre` (≤16), `tours_created: u32`, `shows_completed: u32`, `tickets_sold_total: u64`, `gross_settled_lamports: u64`, `bump` |
| `VenueProfile` | `["venue", authority]` | `authority`, `name` (≤32), `city` (≤32), `lat_e6: i32`, `lng_e6: i32`, `capacity: u32`, `shows_hosted: u32`, `bump` |
| `Tour` | `["tour", band_profile, tour_id (u32 LE)]` | `band_profile`, `tour_id`, `name` (≤32), `region` (≤16), `starts_at: i64`, `ends_at: i64`, `shows_count: u16`, `bump` |
| `Show` | `["show", tour, venue_profile, date (i64 LE)]` | `tour`, `band_profile`, `venue_profile`, `band_authority`, `venue_authority`, `date: i64`, `ticket_price_lamports: u64`, `capacity: u32`, `threshold_bps: u16`, `threshold_deadline: i64`, `band_bps: u16`, `venue_bps: u16`, `payees: Vec<Payee>` (≤4, `{address, bps, label≤16}`), `tickets_sold: u32`, `tickets_refunded: u32`, `escrow_lamports: u64`, `state: ShowState`, `bump`, `vault_bump` |
| vault | `["vault", show]` | system-owned PDA that holds the escrowed lamports |
| `Ticket` | `["ticket", show, buyer]` | `show`, `buyer` (beneficiary), `payer`, `quantity: u16`, `amount_lamports: u64`, `purchased_at: i64`, `refunded: bool`, `bump` |

The band's "proof of past concerts" is the `BandProfile` counters, which only `settle_show` can increase. For the demo, the simulation first runs a short "last year" tour to completion so the history is genuine.

## Instructions

| # | Instruction | Signer | Preconditions | Effects |
|---|---|---|---|---|
| 1 | `register_band(name, genre)` | band authority | none | creates `BandProfile` |
| 2 | `register_venue(name, city, lat_e6, lng_e6, capacity)` | venue authority | `capacity > 0` | creates `VenueProfile` |
| 3 | `create_tour(tour_id, name, region, starts_at, ends_at)` | band authority | `starts_at < ends_at`, `tour_id == band.tours_created` | creates `Tour`, `tours_created += 1` |
| 4 | `propose_show(date, ticket_price_lamports, capacity, threshold_bps, threshold_deadline, band_bps, venue_bps)` | band authority | date inside tour window, `threshold_deadline < date`, `0 < threshold_bps ≤ 10000`, `band_bps + venue_bps == 10000`, `0 < capacity ≤ venue.capacity`, `ticket_price > 0` | creates `Show` in `Proposed`, `tour.shows_count += 1` |
| 5 | `accept_show()` | venue authority | `Proposed` | → `OnSale`, emits `ShowAccepted` |
| 6 | `reject_show()` | venue authority | `Proposed` | closes `Show`, rent back to band authority |
| 7 | `buy_ticket(quantity, beneficiary)` | payer (any wallet; `beneficiary` is the fan who gets the refund) | `OnSale` or `Confirmed`, `now < date`, and while `OnSale` also `now < threshold_deadline`, `tickets_sold + quantity ≤ capacity`, `1 ≤ quantity ≤ 10`, one `Ticket` per (show, beneficiary) | transfers `quantity * price` from payer to vault, creates `Ticket`, updates counters, emits `TicketBought` |
| 8 | `check_threshold()` | anyone | `OnSale` | met → `Confirmed`; deadline passed and not met → `Cancelled`; else `TooEarly` |
| 9 | `refund_ticket()` | anyone | `Cancelled`, ticket not refunded | vault → beneficiary (`amount_lamports`), ticket account closed to the beneficiary, counters updated, emits `TicketRefunded` |
| 10 | `settle_show()` | anyone | `Confirmed`, `now ≥ date` | vault split by bps to band authority, venue authority and payees (passed as remaining accounts in stored order; dust to band), → `Settled`, band and venue counters updated, emits `ShowSettled` |
| 11 | `add_payee(address, bps, label)` | band authority | `Proposed`/`OnSale`/`Confirmed`, `payees.len() < 4`, `bps < band_bps` | pushes payee, `band_bps -= bps` |

Threshold check: `tickets_sold * 10_000 ≥ capacity * threshold_bps` (u64 math, checked).

Settlement dust rule: a share that would leave its recipient below the rent-exempt minimum for an empty account (system transfers to such a balance are rejected) is paid to the band instead, so an unfunded venue or payee wallet can never block a settlement.

## Errors

`Unauthorized`, `InvalidState`, `TooEarly`, `SalesClosed`, `SoldOut`, `InvalidQuantity`, `InvalidSplit`, `InvalidThreshold`, `InvalidDates`, `CapacityExceedsVenue`, `InvalidPrice`, `AlreadyRefunded`, `TooManyPayees`, `PayeeMismatch`, `DuplicatePayee`, `TextLength`, `MathOverflow`, `WrongTourId`, `InvalidCapacity`.

## Events

`BandRegistered`, `VenueRegistered`, `TourCreated`, `ShowProposed`, `ShowAccepted`, `ShowRejected`, `TicketBought`, `ShowConfirmed`, `ShowCancelled`, `TicketRefunded`, `ShowSettled`, `PayeeAdded`.

## Security notes (from the Solana security checklist)

- All authorities are `Signer`; relationships enforced with `has_one`; no `init_if_needed`; typed accounts everywhere.
- Vault is a system-owned PDA funded at proposal with the rent-exempt minimum for a data-less account (the "float"); refunds and settlement move only `escrow_lamports` with a PDA-signed system transfer, never by direct lamport mutation.
- Checked math on every lamport and bps computation; bps sums validated at proposal, payee addition and settlement.
- Permissionless cranks (`check_threshold`, `refund_ticket`, `settle_show`) only move funds to addresses already stored in the `Show`/`Ticket`, so a malicious cranker can only speed things up, not redirect money.
- Settlement verifies each remaining account's key against the stored payee list in order.

## Test coverage

`tests/greenroom.ts` runs every instruction on a local validator: happy paths for all 11, and error paths for text length, zero capacity, wrong tour id, inverted dates, bad split, capacity above venue, deadline after date, zero threshold, wrong signer on accept/reject/add_payee, quantity 0 and 11, sold out, double accept, early crank, late purchase, payee mismatch, settle before date, settle on a cancelled show, and double refund.

## Demo timing

Deadlines and show dates are plain unix timestamps, so the demo and tests use compressed windows (seconds or minutes) while the UI labels them as calendar dates.
