# Demo video script (under 3 minutes)

Record at 1080p, dark desktop, the dashboard full screen, terminal only when noted. Devnet.

## 0:00 – 0:20 Hook
"Booking a tour is months of emails between a band, a booker and thirty venues, and the band carries the risk of empty rooms. Greenroom gives every band, venue, fan and crew member an AI agent, and puts the deal on Solana."

Visual: dashboard home, a tour with eight empty city cards.

## 0:20 – 0:40 What it does
"The band's agent gets a brief: November, Central Europe, eight shows, we draw four hundred. It talks to venue agents, plans a route, and opens ticket sales. Fans pay into an escrow per show. Hit fifty percent by the deadline and the show is on; miss it and everyone is refunded automatically."

Visual: architecture slide (docs/05-architecture.md diagram) for 8 seconds, then back to the dashboard.

## 0:40 – 2:20 Live demo
1. Terminal: `npm run demo:devnet -- --shows 8` (pre-started so offers are already arriving). Show the feed: "Lido Berlin: indie fits our programme, draw 400 vs capacity 800… Offer: 400 tickets, 30% to the venue" (10 s).
2. Dashboard feed: band.plan message with the route and distances; the map draws the route Berlin → Leipzig → Prague → Vienna… (15 s).
3. Show cards flip from Proposed to On sale as venue agents sign on-chain; click one, open the explorer link for `accept_show` (15 s).
4. Fans buying: progress bars move toward the 50% line; narrate "every ticket is a transaction into the show's vault" (15 s).
5. Connect Phantom, buy one ticket yourself, show the transaction (15 s).
6. Deadline: two cities fall short and turn Cancelled; the feed shows refunds landing, your own ticket refunded if you bought in a cancelled city (15 s).
7. Confirmed cities: crew agents pitch sound and photo; the band adds two payees (10 s).
8. Settlement: the show date passes, the vault splits band / venue / crew in one transaction; the band's track record page ticks up (15 s).

## 2:20 – 2:50 Technical highlight
"Everything the agents agree on is enforced by one Anchor program: the threshold, the deadline, the split. The cranks are permissionless, so anyone can trigger a refund or a settlement, and they can only send money where the deal already says it goes. The agents' brain is pluggable: a deterministic planner always runs, and Claude refines decisions when a key is present, with every answer validated before a transaction is built."

Visual: `programs/greenroom/src/instructions/settle_show.rs` for 10 s, then the QA report with the score.

## 2:50 – 3:00 Close
"Greenroom: tours that book themselves, with the deal on-chain. Repo and devnet demo in the submission."
