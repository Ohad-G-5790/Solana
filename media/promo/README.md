# Promo videos

Five 30-second motion-graphics videos, 1920×1080, 60 fps, H.264, no audio. They use the dashboard's design tokens (`packages/web/src/app/globals.css`, `docs/DESIGN.md`): near-black surfaces, `#1ed760` for the product's answers, `#f3727f` for the problem, pill shapes, and the same show card, progress bar with threshold marker, badges and agent feed rows the dashboard renders.

| File | Topic | Closing line |
|---|---|---|
| `out/01-for-musicians.mp4` | Months of email and all the risk → a band agent, a planned route, escrow with a 50% threshold | Book the tour. Skip the risk. |
| `out/02-for-venues.mp4` | Dark nights and unverifiable draws → a venue agent that reads the on-chain record, offers, signs `accept_show`, and is paid by `settle_show` | Fill the calendar. Skip the gamble. |
| `out/03-cheaper-concerts.mp4` | The fee stack and the layers in the middle → agents, escrow, Solana fees in cents, automatic refunds | Pay for the show. Not the middlemen. |
| `out/04-musicians-earn-more.mp4` | Paid last → paid by code (70/30 default split), a track record that lowers the venue's ask, cheaper roads and local crew | More of every ticket goes to the people on stage. |
| `out/05-end-the-monopoly.mp4` | One company in the middle → a protocol with no middle to own | You can't buy out an open protocol. |

## Series 2: the musician's phone (vertical)

Fifteen 30-second videos, 1080×1920, 60 fps, for Reels, TikTok and Shorts, in `out/vertical/`. Everything happens on the musician's phone, and the text is first person.

| Files | What they follow |
|---|---|
| `a1`–`a5` · On tour | One band (Cinema of Royal Street, draws 400) through one November tour: Plan (one brief, offers, a route) → Book (my terms, best offer per city, the venue signs, terms locked) → Sell (live sales, every city, confirmations, Vienna refunded) → Show night (hire local crew into the split, the room, settlement) → Payday (paid the morning after, where every euro went, the tour city by city, a better record). |
| `b1`–`b5` · Musicians | Five different acts: Lena, solo, 150 a night (no booker, six small rooms, 75 tickets confirms a show); Crimson Gardens, punk trio (the shortest loop, local sound in every city); The Broken Tides, 600 a night (14 settled shows, venues ask 27% instead of 35%); Rusty Pilots, 3,500 a night (no fee stack, 15,500 tickets in escrow, one-transaction settlement); Jonas, session drummer (pitches only for sold shows, paid with the band). |
| `c1`–`c5` · Small or big | Lena and Rusty Pilots side by side: booking, the 50% threshold, every ticket visible, payday (the split follows the record, not the size), and the track record that lets a small act catch up. |

Splits follow the venue agents' pricing in the app: 30% base, 35% for a band with no on-chain record, 27% for a strong one (3+ settled shows averaging at least half the draw). Lena's first tour is therefore 65/35, Rusty Pilots and The Broken Tides are 73/27, and the tour band is 70/30 until its record becomes strong. Euro amounts are examples; each end card says "Illustrative figures. Tickets settle on Solana." The b2 distances are straight-line kilometres between the cities in `data/venues.json`.

## What the claims rest on

Product mechanics come from the code: the 50% threshold and 70/30 default split (`docs/00-kickoff.md`, `packages/agents/src/orchestrator.ts`), the venue agent's pricing (30% base, +5 points for a band with no history, −3 for a strong record: `packages/agents/src/venue-agent.ts`), permissionless cranks (`docs/01-program-spec.md`), crew payees, the ≤1% protocol fee from the business plan (`docs/06-submission.md`), and the agent message formats. Venues and cities are real entries from `data/venues.json`; the band is from a recorded run. Euro amounts, the inbox, the calendar and the checkout are labelled examples.

Outside facts shown on screen, with their sources:

- Primary-market ticket fees averaged 27% of the ticket price in the events GAO reviewed: U.S. Government Accountability Office, [GAO-18-347](https://www.gao.gov/products/gao-18-347) (2018).
- Ticketmaster controls roughly 80% or more of primary ticketing at major U.S. concert venues: allegation in the U.S. Department of Justice complaint, May 2024.
- On April 15, 2026 a federal jury (S.D.N.Y., the states' case) found Live Nation and Ticketmaster illegally monopolized ticketing; remedies, including a possible breakup, are pending, with breakup arguments not expected before 2027 ([NBC News](https://www.nbcnews.com/business/consumer/livenation-illegally-monopolized-ticketing-market-jury-antitrust-trial-rcna273714), [Courthouse News](https://courthousenews.com/penalties-phase-of-live-nation-ticket-monopoly-trial-will-stretch-into-2027/)). Re-check the remedies status before publishing after October 2026.

## Re-rendering

Each video is a page that draws itself as a pure function of time (`src/engine.js` plus `src/v1.js` … `src/v5.js`); `render.mjs` steps it frame by frame in headless Chromium and pipes the frames into ffmpeg. Needs Playwright (a global install works, hence `NODE_PATH`), ffmpeg with libx264, and the Inter / Inter Display fonts.

```bash
NODE_PATH="$(npm root -g)" node media/promo/render.mjs                    # all five at 60 fps, ~5 min each
NODE_PATH="$(npm root -g)" node media/promo/render.mjs --only 2 --fps 30  # one video, 30 fps
NODE_PATH="$(npm root -g)" node media/promo/render.mjs --only 5 --stills 3,12.5,28   # PNG stills to out/stills
NODE_PATH="$(npm root -g)" node media/promo/render.mjs --series phone                  # all fifteen vertical videos
NODE_PATH="$(npm root -g)" node media/promo/render.mjs --series phone --only a1,c4      # some of them
```

Open `src/index.html?v=3&t=12.5` (or `src/phone.html?v=b4&t=20`) in a browser to look at a single frame. The vertical series lives in `src/phone-kit.js`, `src/phone.css` and `src/phone/*.js`. `src/geo.js` (map outlines and venues) is generated by `tools/build-geo.mjs` from `world-atlas@2.0.2/countries-50m.json` (Natural Earth, public domain) and `data/venues.json`.
