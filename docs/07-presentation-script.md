# Presentation video script (2 to 3 minutes)

Colosseum asks for two videos: this presentation (team, problem, product, business) and the product demo (see [04-demo-script.md](04-demo-script.md)). Talk to camera or over slides; keep the demo footage for the other video.

## 0:00 – 0:25 Who and why
"I'm [name]. I've [one line of relevant background: played in bands / booked shows / built software]. Booking a tour for a band that draws a few hundred people is still months of email, deposits and a booker's cut, and the band carries all the risk of empty rooms."

## 0:25 – 0:55 The idea
"Greenroom gives every band, venue, fan and crew member an AI agent, and puts the deal on Solana. The band's agent negotiates a route with venue agents in minutes. Tickets sell into an escrow per show. If a show reaches its threshold by the deadline it's confirmed; if not, it's cancelled and every fan is refunded automatically. After the show, the escrow splits between band, venue and crew in one transaction."

Slide: the state machine `Proposed → On sale → Confirmed / Cancelled → Settled`.

## 0:55 – 1:30 Why on-chain, why Solana
"The deal is a program, not a promise: threshold, deadline and split are enforced on-chain. Cranks are permissionless and can only send money where the deal already says. Fees are cents, so thousands of small ticket transactions are fine. And a band's settled shows become a track record any venue agent can verify. Nothing here would work on a shared spreadsheet."

## 1:30 – 2:05 What we built in the hackathon
"An Anchor program with 11 instructions and a full test suite. Band, venue, fan and crew agents that negotiate on a message bus; a deterministic planner always runs and Claude can refine decisions, with every answer validated before a transaction is built. A seed world of 136 real venues in 35 cities across five countries. A dashboard with the route, live feed and wallet ticket purchase. And a QA bot that scores each part and gates the release at 8.5 out of 10."

Slide: architecture diagram from [05-architecture.md](05-architecture.md).

## 2:05 – 2:40 Business and go-to-market
"We start with venues of 150 to 1,500 capacity in Central Europe, where booking is still email. A venue agent costs nothing to run and brings a calendar and terms; bands follow because they get a bookable route in minutes. Revenue is a small protocol fee on settled shows and premium placement in the crew marketplace. Next: USDC tickets, a venue check-in before settlement, dynamic pricing, and an open message format so any agent framework can book into the same program."

## 2:40 – 3:00 Close
"Greenroom: tours that book themselves, with the deal on-chain. The repo, the devnet program and the demo are in the submission. Thank you."
