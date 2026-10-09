# Greenroom

**Tours that book themselves, with the deal on Solana.**

Live: [dashboard](https://ohad-g-5790.github.io/Solana/) · [program on devnet](https://explorer.solana.com/address/4KSaYomRjbnijK1yAELZEGFMPsoPE6u7unY2T6mASUT8?cluster=devnet) · [source](https://github.com/Ohad-G-5790/Solana)

[![ci](https://github.com/Ohad-G-5790/Solana/actions/workflows/ci.yml/badge.svg)](https://github.com/Ohad-G-5790/Solana/actions/workflows/ci.yml) [![program](https://github.com/Ohad-G-5790/Solana/actions/workflows/program.yml/badge.svg)](https://github.com/Ohad-G-5790/Solana/actions/workflows/program.yml) [![pages](https://github.com/Ohad-G-5790/Solana/actions/workflows/pages.yml/badge.svg)](https://github.com/Ohad-G-5790/Solana/actions/workflows/pages.yml)

Every band, venue, fan and crew member has an AI agent. A band's agent takes a brief ("November, Central Europe, eight shows, we draw 400"), negotiates with venue agents, plans a route that makes geographic sense, asks the band to approve the venues and the route, and only then opens ticket sales months early. Fans pay into an on-chain escrow per show. Each show carries a sell-through threshold and a deadline: hit it and the show is confirmed; miss it and every fan is refunded automatically. After the show date the escrow is split between the band, the venue and the crew the band hired. No booker, no promoter, no deposit risk, and the band's settled shows become a track record that venues can verify on-chain.

Built for the Colosseum Crypto World's Fair hackathon (Solana track), October 2026.

## What is in the box

| Part | Where | Status |
|---|---|---|
| Anchor program: profiles, tours, shows with escrow vaults, tickets, threshold/refund/settlement cranks, crew payees | `programs/greenroom` | 11 instructions, 13 integration tests on a local validator; deployed on devnet |
| Agents: band, venues, fans, crew, crank, message bus, pluggable brain (heuristic or Claude) | `packages/agents` | end-to-end demo on localnet and devnet |
| Seed world: 136 real venues in 35 cities across DE/AT/FR/PL/CZ, 100 generated bands, 100 crew and 60 fans per city | `packages/world`, `data/venues.json` | deterministic |
| Dashboard for the band: connect a wallet, create a tour from four answers and book it with one approval, approvals (venues, route, replacement shows), route with drive times (round trips home, reorder or drop stops before booking), show health, venues by country → city → room, route planner, agent feed, wallet buy/refund, track record with a 0–10 reputation | `packages/web` | Next.js, design per `docs/DESIGN.md`; live on GitHub Pages |
| Keeper: lets seed venues accept, fans buy, and the crank confirm, refund and settle the shows bands book from the browser | `packages/agents/src/keeper.ts` | GitHub Actions, every 10 minutes |
| QA bot: automated checks + rubric judge, weighted score, pass at 8.5, five-loop limit; UI bot that walks the dashboard in Chromium as a band would | `qa/` | `npm run qa`, `npm run ui-bot` |

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

### Your band, your wallet: create a tour with one click

No command line needed. On the [live dashboard](https://ohad-g-5790.github.io/Solana/):

1. In Phantom (or Solflare), create an account for the band, switch it to Solana devnet (Phantom: Settings → Developer settings → Testnet mode) and give it a little devnet SOL.
2. **Connect wallet.** Before that the site shows nothing personal; after it, the dashboard is that wallet's band. A wallet without a band profile gets a **Set up your band** form (name and genre, one approval of about 0.002 SOL).
3. **Create your first tour.** Four answers: how many people you bring (100, 200, 500, 1,000, 2,500 or 5,000), the ticket price, the first city, and how long the tour is (7 to 30 days).
4. **Plan my tour.** The venue agents' offers are computed in the browser and the route appears on the map with dates, drive per leg and days off. Nothing is booked yet; change any answer and plan again.
5. **Book this tour.** Your wallet asks once and creates the tour and every show on devnet.

From there it runs by itself: the **keeper** workflow (`.github/workflows/keeper.yml`, every 10 minutes on GitHub Actions, using the demo wallet secret) lets the seed venues sign the shows whose terms they would offer themselves (and decline the rest), simulates fans buying (each show sells at most 40 tickets of at most 200 €, and each run spends at most 0.3 SOL, ticket rent included), confirms or cancels each show at its deadline, refunds cancelled ones and settles the rest. Devnet clocks are compressed: sales run 40 minutes, each show sells a 5% sample of the room (12–40 tickets) at 1 € = 0.00001 SOL of play money. The seed venues' and simulated fans' keys derive from the public world seed, so they are demo keys for devnet only; the keeper refuses to run on mainnet and caps what the demo wallet spends on fans per run. Follow it on the Dashboard and in the **Agent feed**, which tells the tour in four phases (planning, booking, ticket sales, results): who said what (your agent, each venue, the fans, the settlement), one running line per show for ticket sales, and the latest few messages per phase with the rest a tap away. The negotiation (every venue's offer or decline with its reason, and your agent's plan) is recorded in the browser that booked the tour.

The route preview asks whether the tour should finish near the first city (the default: the stop closest to home is played last) and lets you move stops earlier or later or drop them; days, drives and the drive home update as you go, compared with the agent's suggestion. The **Band record** shows a 0–10 reputation computed only from the on-chain record (fans per played show and shows played, both on a log scale: a stadium star with hundreds of shows is a 10). The `devnet-demo` workflow with `band = mine` and `history = only` plays a short past tour as your band to build that record.

Visitors land on a short pitch (today versus with Greenroom, how it works) with a large "This is a demo version" email sign-up for the full release; the app's menu appears once a wallet connects or they explore the demo band, and inside the app a slim notice keeps the sign-up at hand. Sign-ups land in a Google Sheet through a small Apps Script web app: paste `scripts/signup-sheet.gs` into the sheet (Extensions → Apps Script), deploy it as a web app that anyone can call, and put its URL in the repository variable `GREENROOM_SIGNUP_URL`. Each sign-up becomes a row (time, email, source), repeats are added once. Any other endpoint that takes a POSTed `email` field (Formspree and the like) works too; without one the notice shows without the form.

Developers can still run the agents as their own band from a terminal (`npm run demo:devnet -- --band-keypair <file> --band-name ... --genre ... --draw ... --home-city ... --approve`); keep key files out of the repository.

### Approving the tour yourself

`npm run demo:fast` runs on auto-pilot: the band agent approves its own recommendations. To make the band's decisions yourself, start the agents in approval mode and keep the dashboard open on **Approvals**:

```bash
npm run demo:approve                  # local validator + agents; the run waits for you (validator stays up)
cp packages/web/.env.local.example packages/web/.env.local   # once: point the dashboard at the local validator
npm run dev -w @greenroom/web         # in a second terminal; open http://localhost:3000/approvals
```

The agent stops three times:

1. **Venues.** Every offer, grouped by city, with tickets offered, the venue's share, minimum price, free days, a fit score and the drive from your home city. The planner's picks and a few backups are pre-ticked; untick what you do not want to play. A draft route updates as you tick.
2. **Route.** The itinerary planned from the approved venues: dates, drive per leg (with warnings for long drives and legs that need a travel day), days off, and money at threshold and at sellout. Approve it to book, or untick stops to get a new route without them. Nothing is on-chain before you approve.
3. **Replacement** (when a show misses its threshold). Fans are refunded automatically; the agent offers to keep the date with the same venue at a smaller capacity, a smaller room in the same city, or an approved venue in a nearby city, with the extra driving for each. Pick one, or let the date go. Offers lapse after five minutes (`--replacement-timeout`).

Decisions go from the dashboard (`POST /api/approvals`) to `data/runs/<run>/decisions.jsonl`, which the running agent polls; each answer is validated before it is used. The hosted dashboard shows recorded runs, so its decision buttons are off.

Maps show country borders (Natural Earth 1:50m, public domain; regenerate with `packages/web/scripts/build-borders.mjs`). The **Venues** page goes from a country to its cities to their rooms (or a search by name), with filters for size, programme and maximum drive from any city folded away, and the **Route planner** turns any list of cities or venues (a city stop keeps every venue there open until you pin one) into a day-by-day schedule with drive times, travel days for the long hauls, days off and a copyable itinerary. Drive times are estimates (road ≈ 1.2 × straight line, a loaded van at ~90 km/h with EU-style breaks), not routing.

### Devnet

Deploying costs about 2.1 SOL of rent for the 300 KB program plus under 1 SOL for a demo run (tickets are 0.001 SOL on public clusters). With a funded wallet:

```bash
solana config set --url devnet
npm run deploy:devnet
npm run demo:devnet -- --shows 8 --history
```

The public devnet RPC rate-limits bursts, so the agents slow down off-localnet (one transaction at a time, short pauses) and retry transient errors; a run of 8 shows takes about 10 minutes there. A free Helius, RPC Fast or FluxRPC endpoint in `GREENROOM_RPC_URL` removes most of the waiting. Budget: about 0.003 SOL per simulated ticket (price plus the ticket account's rent, paid by the hub wallet) and 0.003 SOL per venue, so a full 136-venue, 8-show run needs roughly 1 SOL.

The program is deployed on devnet as `4KSaYomRjbnijK1yAELZEGFMPsoPE6u7unY2T6mASUT8` ([explorer](https://explorer.solana.com/address/4KSaYomRjbnijK1yAELZEGFMPsoPE6u7unY2T6mASUT8?cluster=devnet), deployed 2026-10-08, slot 508938533, tx `2RJsTWwsfgLoxCSgZWd4Mk4GamF3wUCE5btCHAv9ywCrX5P8fELyNyPTDhjoTdNFrcWVQikGta5PEdaYPLTPwYNY`). The devnet build predates one change in this repo, the settlement dust rule in `settle_show` (covered by the test suite); redeploying needs about 1.7 SOL of temporary buffer rent and happens at the next faucet top-up.

### Letting the agents think with Claude

Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY` (a Claude Console key, not a subscription login). The demo CLI loads `.env` from the repo root. The band agent, venue agents and crew hiring then use Claude for their decisions; the deterministic planner always runs first and validates every model answer. Without a key everything runs in heuristic mode, which is also what the tests and the QA bot use.

## How a tour happens

1. The band agent broadcasts a brief with its on-chain track record.
2. Venue agents in the requested countries answer with offers (capacity, share, minimum price, free days) or decline.
3. The band approves the venues it is willing to play (auto-pilot takes the agent's recommendation).
4. The band agent plans the route (best offer per city, nearest-neighbour + 2-opt, rest days, a travel day before any leg over 9 hours of driving) and the band approves it; only then does the agent propose shows on-chain.
5. Venue agents check each proposal against their offer and sign `accept_show`.
6. Fan agents buy tickets into each show's vault; a real wallet can buy from the dashboard too.
7. The crank confirms shows that reach the threshold and cancels the ones that miss the deadline; cancelled shows are refunded ticket by ticket, and the band is offered a replacement show (smaller capacity, smaller room, or a nearby city) that goes on sale if the band picks one.
8. Crew agents pitch on confirmed shows; the band adds the ones it hires as payees.
9. After the show date the crank settles: vault split by bps, band's track record updated.

Full spec: [docs/01-program-spec.md](docs/01-program-spec.md). Architecture: [docs/05-architecture.md](docs/05-architecture.md).

## Repository layout

```
programs/greenroom/     Anchor program (Rust)
tests/                  program integration tests (mocha, local validator)
packages/sdk            TypeScript client, PDAs, vendored IDL
packages/world          real venues + generated bands, crew, fans
packages/agents         agents, brain, planner, crank, orchestrator, CLI
packages/web            Next.js dashboard
qa/                     QA bot (checks, rubric, judge scores, reports) and the UI bot
scripts/                setup, local validator, test and demo runners
data/                   venues.json, generated runs
docs/                   kickoff, spec, plan, QA rubric, design system, demo script, architecture
```

## QA gate

`npm run qa` runs every automated check (build, clippy, program tests, agents unit + end-to-end, dashboard build/typecheck/lint/design tokens, the UI bot, world data, docs, developer experience), merges rubric judge scores from `qa/judge/*.json`, and writes `qa/reports/latest.md`. Each part is scored 1–10, the overall score is weighted, **8.5 passes**, and the bot stops after the fifth failed loop. `qa/reports/latest.md` and `qa/state.json` are kept in the repo so the loop history is visible. `npm run qa:dry` (and `qa:quick`, which skips the validator checks) does not count as a loop and writes `qa/reports/dry-run.md` instead.

The **UI bot** (`qa/src/ui-bot.ts`, `npm run ui-bot`) checks that the dashboard is intuitive, not how it looks. It builds the static site and drives it in Chromium with a test wallet that cannot sign and a faked devnet. Its checks:

- the first screen is a short pitch with the email sign-up and a single connect button; no app menu until a wallet connects or the demo is opened
- connecting shows that wallet's band, with its address in the right case
- a band without a tour sees one obvious next step
- a tour takes four answers and shows the route, the drive home, money and risk before anything is booked, and the band can reorder it
- after booking, the dashboard shows your own tour: the planned days, "booked by you", which shows wait on a venue, and only your activity
- every page shows its heading within 1.5 s on a slow chain
- nothing scrolls sideways at 390 px
- every control has a name
- each page has one heading and a marked nav item
- no chain jargon on band pages
- buttons come from one shared set
- the agent feed tells the tour in phases, says who speaks and starts compact
- visitors can explore without a wallet, and Venues goes country → city → rooms

Each check is part of the **User experience** score, and `--shots <dir>` saves screenshots for a reviewer. On GitHub, the **qa** workflow (Actions → qa → Run workflow) runs the whole QA bot in the Anchor image, with the validator checks; tick *count* to record the loop.

## Hosting the dashboard

The dashboard is published to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`: https://ohad-g-5790.github.io/Solana/ . That build is a static export (`npm run build:static -w @greenroom/web`) that reads live account state from devnet and the recorded run bundled in `packages/web/public/demo`. To publish a new devnet run, copy its `summary.json` and `transcript.jsonl` over the bundled ones and push.

Honest note on the bundled run: as of 2026-10-08 it is a three-show devnet tour in which every show was cancelled and refunded, because the demo's hub wallet ran out of devnet SOL mid-sale. The cancellations and refunds are real transactions; a funded eight-show run with confirmed and settled shows replaces it as soon as the faucet allows (the full local run is what the videos show).

The same app also runs as a Node server (`npm run dev` / `next build`) with API routes that read `data/runs`; on Vercel set the root directory to `packages/web` and the `NEXT_PUBLIC_*` variables from `.env.example`.

## Running the devnet demo from GitHub (no key needed)

**Booking as your own band from GitHub.** Add your band wallet's private key (Phantom: export private key; or a Solana CLI JSON array) as the repository secret `GREENROOM_BAND_WALLET`, then run the **devnet-demo** workflow with `band = mine` and `band_profile` such as `The Running Pigeons|indie|400|Berlin`. Your wallet signs the band's transactions (its profile is registered if missing); the demo wallet pays fees and fans. Connect the same wallet on the dashboard to see the tour. The dashboard reads the rate-limited public devnet RPC unless the repository variable `GREENROOM_PUBLIC_RPC_URL` names another one (it is visible in the page, so use a key restricted to the site's domain).

The repository holds a dedicated devnet demo wallet as an encrypted Actions secret (`GREENROOM_DEVNET_WALLET`, address `4wEy82SyTb65gK2G7pjbxFg7NqiXvAFr8Qjzz34pVBqp`). Anyone with write access can start the **devnet-demo** workflow from the Actions tab (choose shows, venues, fans, history, publish); it runs the agents against the deployed program with that wallet, uploads the run as an artifact and, with publish on, commits the run to `packages/web/public/demo` so the live dashboard shows it. The key never leaves GitHub's secret store and is not the program's upgrade authority. Optional secrets: `GREENROOM_RPC_URL` (a faster devnet RPC) and `ANTHROPIC_API_KEY` (Claude brain). Refill the demo wallet from any faucet when it runs low.

## Continuous integration

Three workflows run on every push to `main`: `ci` (type checks, unit tests, dashboard lint and build on Node, and the UI bot in Chromium with its screenshots as an artifact), `program` (builds the Anchor program, runs the 13 integration tests and a full agents run on a Linux validator inside the official Anchor 1.2.1 image; the container needs `--security-opt seccomp=unconfined` because the Agave 4.x validator requires io_uring), and `pages` (publishes the static dashboard). `keeper` runs every 10 minutes to move devnet shows along, and `qa` runs the QA bot on demand.

## Windows note

The Agave 4.x `solana-test-validator` cannot unpack its genesis archive on Windows ("Access is denied"), and `anchor init`/`anchor test` cannot spawn yarn or npm there. This repo works around both: `scripts/local-validator.mjs` starts a Solana 1.18 validator (install once with `agave-install init 1.18.18`, then `agave-install init 4.1.2` to switch back) with the program preloaded, and the program is built for SBPF v0 (`--arch v0`) so that validator can run it. `anchor build` needs `--tools-version v1.54` on Windows because the 4.1 build tool panics for any other platform-tools version. All of this is wired into the npm scripts.

## Roadmap

- USDC (SPL) tickets alongside SOL; Token-2022 compressed tickets as NFTs.
- Dispute window before settlement with a venue check-in signature.
- Dynamic pricing proposals from the band agent based on sell-through.
- Open protocol: any agent framework can speak the bus messages; the program is the contract.

## License

MIT
