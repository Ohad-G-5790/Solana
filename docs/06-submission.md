# Colosseum submission copy (Crypto World's Fair, Solana track)

Fill the portal from this file. Team fields are yours to complete.

## Name
Greenroom

## Tagline (one sentence)
AI agents that book a band's whole tour and put every deal, ticket and payout on Solana.

## Description (about 350 words)

**The problem.** Booking a tour is months of email between a band, a booker and dozens of venues. Nobody knows if a show will sell until it is too late, so venues demand deposits, bands eat the risk of empty rooms, and bookers take a cut for carrying messages. Small and mid-size acts, the ones who need touring income most, get the worst terms or no tour at all.

**What Greenroom does.** Every band, venue, fan and crew member has an agent. A band's agent takes a brief ("November, Central Europe, eight shows, we draw 400") and broadcasts it with the band's on-chain track record. Venue agents answer with offers: capacity, revenue share, minimum price, free dates. The band's agent plans a route that makes geographic sense, proposes each show on-chain, and venue agents sign to accept. Tickets go on sale immediately into an escrow vault per show. Each show carries a sell-through threshold and a deadline: reach it and the show is confirmed; miss it and the program cancels the show and refunds every fan. Local crew agents pitch sound, lights, photo and transport on confirmed shows, and the band adds them as payees. After the show date, anyone can trigger settlement: the vault splits by the stored shares, and the band's settled shows become a verifiable track record for the next tour.

**Why Solana.** The deal is one program: threshold, deadline, split and refund logic are enforced on-chain, not by a promoter's word. Thousands of small ticket transactions per tour cost cents. Cranks are permissionless, so confirmation, refunds and settlement happen without a trusted operator, and they can only move money where the deal already says it goes. The band's history lives in account state any venue agent can read.

**What is built.** An Anchor program with 11 instructions and 13 integration tests; a negotiation layer with band, venue, fan and crew agents whose decisions run on a deterministic planner and can be refined by Claude with every answer validated before a transaction is built; a seed world of 136 real venues in 35 cities across Germany, Austria, France, Poland and Czechia; a dashboard with the route, threshold progress, live agent feed, wallet ticket purchase and refund; and a QA bot that scores every part and gates the release at 8.5/10.

**What is next.** USDC tickets, a venue check-in signature before settlement, dynamic pricing from sell-through, and an open message format so any agent framework can book into the same program.

## Blockchains and tools
Solana (devnet), Anchor 1.2, @anchor-lang/core, web3.js, Next.js, Claude API (optional agent brain).

## Go-to-market
Start with DIY and mid-size touring acts in Central Europe and the clubs that already book them (150–1,500 capacity), where booking is still email and deposits. Onboard venues first: a venue agent costs nothing to run and brings a calendar and terms. Bands follow because the agent returns a bookable route in minutes instead of months. Revenue: a protocol fee on settled shows (≤1%) and premium crew-marketplace placement.

## Demand validation
Clubs of this size run on thin margins and rely on promoters to carry risk; bands at this level cannot get tours without a booker. Threshold-gated sales (the "Kickstarter for shows" model) already exist off-chain in niche products, which shows demand; none of them settle trustlessly or let venues verify a band's history.

## Distribution
Venue-side first (agent + calendar integration), then band onboarding through the venues' existing relationships; fan purchases through any Solana wallet and the dashboard, later through embedded wallets and Blinks.

## Links
- Repository: https://github.com/Ohad-G-5790/Solana
- Demo dashboard: https://ohad-g-5790.github.io/Solana/ (GitHub Pages, static export reading devnet)
- Program on devnet: 4KSaYomRjbnijK1yAELZEGFMPsoPE6u7unY2T6mASUT8 (deployed 2026-10-08, slot 508938533; upgrade authority 3Aon5LFqG7y9Q1fdqMhMDctxFwxFtvGcZvnTfseHvJcz)
- Presentation video (2–3 min) and product demo video (≤3 min): (YouTube, unlisted)
