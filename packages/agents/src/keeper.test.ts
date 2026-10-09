import assert from "node:assert/strict";
import { test } from "node:test";
import { Keypair, PublicKey } from "@solana/web3.js";
import { generateWorld } from "@greenroom/world";
import { keypairFromSeedHex, venuePda } from "@greenroom/sdk";
import { runKeeper, venueTermsProblems } from "./keeper.ts";
import { FakeChain } from "./testing/fake-chain.ts";

test("keeper: registers venues, venues sign the band's proposals, fans buy, the crank finishes the shows", { timeout: 60_000 }, async () => {
  const chain = new FakeChain(20);
  const world = generateWorld({ seed: "greenroom-2026", bands: 1, crewPerCity: 1, fansPerCity: 10 });
  const pick = (city: string) => world.venues.find((v) => v.city === city)!;
  const venues = [pick("Berlin"), pick("Hamburg"), pick("Munich")];
  // Berlin is on-chain already; the keeper registers the rest itself.
  const berlinKp = keypairFromSeedHex(venues[0].seed);
  chain.registerVenue_(berlinKp.publicKey, venuePda(berlinKp.publicKey, chain.programId), venues[0].capacity);

  // What the dashboard does with the band's wallet: open a tour, propose shows.
  const band = Keypair.generate();
  const now = chain.now();
  const { tour } = await chain.createTour(band, 0, "Test", "EU", now - 60, now + 3600);
  // the keeper registers missing venues before its loop, so propose after a first short run
  await runKeeper({ rpcUrl: "fake", payer: band, minutes: 0.005, tickMs: 50, registerVenues: 500, rules: { minSalesSec: 5 }, log: () => {}, deps: { client: chain.client, connection: chain.connection } });
  const proposals: PublicKey[] = [];
  for (const [i, v] of venues.entries()) {
    const profile = venuePda(keypairFromSeedHex(v.seed).publicKey, chain.programId);
    const { show } = await chain.proposeShow(band, tour, profile, {
      date: now + 80 + i,
      ticketPriceLamports: 1_000_000,
      capacity: 12,
      thresholdBps: 5000,
      thresholdDeadline: now + 40 + i,
      bandBps: 6500,
      venueBps: 3500,
    });
    proposals.push(show);
  }

  const stats = await runKeeper({ rpcUrl: "fake", payer: band, minutes: 0.12, tickMs: 100, salesWindowSec: 40, rules: { minSalesSec: 5 }, log: () => {}, deps: { client: chain.client, connection: chain.connection } });
  assert.equal(stats.accepted, 3, "every venue signed");
  assert.ok(stats.ticketsBought > 0, "fans bought tickets");
  const states = await Promise.all(proposals.map(async (p) => Object.keys((await chain.fetchShow(p)).state)[0]));
  assert.ok(states.every((s) => s === "settled" || s === "cancelled"), `every show reached the end: ${states}`);
  assert.ok(states.includes("settled"), "at least one show was played and paid out");
  assert.ok(chain.calls.filter(([n]) => n === "registerVenue").length >= 2, "missing venues were registered");
});

test("keeper: rejects proposals a venue would not sign and never buys tickets for them", { timeout: 30_000 }, async () => {
  const chain = new FakeChain(20);
  const world = generateWorld({ seed: "greenroom-2026", bands: 1, crewPerCity: 1, fansPerCity: 10 });
  const v = world.venues.find((x) => x.city === "Berlin")!;
  const kp = keypairFromSeedHex(v.seed);
  const profile = venuePda(kp.publicKey, chain.programId);
  chain.registerVenue_(kp.publicKey, profile, v.capacity);
  const band = Keypair.generate();
  const now = chain.now();
  const { tour } = await chain.createTour(band, 0, "Greedy", "EU", now - 60, now + 3600);
  const base = { ticketPriceLamports: 1_000_000, capacity: 12, thresholdBps: 5000, bandBps: 6500, venueBps: 3500 };
  // 1% to the venue and a 1% threshold: the demo wallet's fans would pay this band
  const { show: greedy } = await chain.proposeShow(band, tour, profile, { ...base, date: now + 80, thresholdDeadline: now + 40, thresholdBps: 100, bandBps: 9900, venueBps: 100 });
  const fair = await chain.proposeShow(band, tour, profile, { ...base, date: now + 300, thresholdDeadline: now + 200 });
  // the same venue on the same night as the fair show
  const { show: twice } = await chain.proposeShow(band, tour, profile, { ...base, date: now + 301, thresholdDeadline: now + 200 });

  const stats = await runKeeper({ rpcUrl: "fake", payer: band, minutes: 0.02, tickMs: 50, registerVenues: 0, rules: { minSalesSec: 5 }, log: () => {}, deps: { client: chain.client, connection: chain.connection } });
  assert.equal(stats.rejected, 2, "the greedy and the double-booked proposals were rejected");
  assert.equal(stats.accepted, 1);
  assert.ok(!chain.shows.has(greedy.toBase58()), "the greedy show is closed");
  // one of the two same-night shows is signed, whichever the keeper saw first
  const live = [fair.show, twice].filter((k) => chain.shows.has(k.toBase58()));
  assert.equal(live.length, 1, "one show per venue and night");
  assert.ok(chain.calls.every(([n, s]) => n !== "buyTicket" || s === live[0].toBase58()), "tickets only for the signed show");
});

test("keeper: venue terms follow the venue's own offer rule", () => {
  const world = generateWorld({ seed: "greenroom-2026", bands: 1, crewPerCity: 1, fansPerCity: 1 });
  const v = world.venues[0];
  const band = { genre: v.genres[0], showsCompleted: 0, ticketsSoldTotal: 0 };
  const ok = { venueBps: 3500, ticketPriceLamports: 200_000, capacity: 20, thresholdBps: 5000, date: 1000, thresholdDeadline: 400 };
  assert.deepEqual(venueTermsProblems(v, band, ok, []), []);
  assert.match(venueTermsProblems(v, band, { ...ok, venueBps: 1000 }, []).join(), /share/);
  assert.match(venueTermsProblems(v, band, { ...ok, ticketPriceLamports: 50_000_000 }, []).join(), /price/);
  assert.match(venueTermsProblems(v, band, { ...ok, capacity: 500 }, []).join(), /capacity/);
  assert.match(venueTermsProblems(v, band, { ...ok, thresholdBps: 500 }, []).join(), /threshold/);
  assert.match(venueTermsProblems(v, band, ok, [1001]).join(), /already/);
  assert.deepEqual(venueTermsProblems(v, band, ok, [1060]), [], "a minute later on chain is another tour day");
  assert.match(venueTermsProblems(v, band, ok, [], 390).join(), /sales too short/);
  assert.match(venueTermsProblems(v, band, ok, [], 400 - 7 * 3600).join(), /too long/);
  assert.deepEqual(venueTermsProblems(v, band, ok, [], 400 - 1800), []);
  const offGenre = ["rock", "metal", "punk", "indie", "electronic", "hiphop", "jazz", "pop", "folk"].find((g) => !v.genres.includes(g as never))!;
  // 12 sample tickets is a ~240-person band: too small for a 1,000 room that does not play its genre
  assert.match(venueTermsProblems({ ...v, capacity: 1000 }, { ...band, genre: offGenre }, { ...ok, capacity: 12 }, []).join(), /programme/);
});

test("keeper: the fan budget is read from chain, so a band at its cap gets no more simulated fans", { timeout: 30_000 }, async () => {
  const chain = new FakeChain(20);
  const world = generateWorld({ seed: "greenroom-2026", bands: 1, crewPerCity: 1, fansPerCity: 10 });
  const v = world.venues.find((x) => x.city === "Berlin")!;
  const kp = keypairFromSeedHex(v.seed);
  const profile = venuePda(kp.publicKey, chain.programId);
  chain.registerVenue_(kp.publicKey, profile, v.capacity);
  const band = Keypair.generate();
  const now = chain.now();
  const { tour } = await chain.createTour(band, 0, "Capped", "EU", now - 60, now + 3600);
  await chain.proposeShow(band, tour, profile, { ticketPriceLamports: 1_000_000, capacity: 12, thresholdBps: 5000, bandBps: 6500, venueBps: 3500, date: now + 300, thresholdDeadline: now + 200 });
  const stats = await runKeeper({ rpcUrl: "fake", payer: band, minutes: 0.02, tickMs: 50, registerVenues: 0, rules: { minSalesSec: 5, maxFanLamportsPerBand: 0 }, log: () => {}, deps: { client: chain.client, connection: chain.connection } });
  assert.equal(stats.accepted, 1, "the venue still signs");
  assert.equal(stats.ticketsBought, 0, "no fans once the band is at its cap");
});
