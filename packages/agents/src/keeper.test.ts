import assert from "node:assert/strict";
import { test } from "node:test";
import { Keypair, PublicKey } from "@solana/web3.js";
import { generateWorld } from "@greenroom/world";
import { keypairFromSeedHex, venuePda } from "@greenroom/sdk";
import { runKeeper } from "./keeper.ts";
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
  await runKeeper({ rpcUrl: "fake", payer: band, minutes: 0.005, tickMs: 50, registerVenues: 500, log: () => {}, deps: { client: chain.client, connection: chain.connection } });
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

  const stats = await runKeeper({ rpcUrl: "fake", payer: band, minutes: 0.12, tickMs: 100, salesWindowSec: 40, log: () => {}, deps: { client: chain.client, connection: chain.connection } });
  assert.equal(stats.accepted, 3, "every venue signed");
  assert.ok(stats.ticketsBought > 0, "fans bought tickets");
  const states = await Promise.all(proposals.map(async (p) => Object.keys((await chain.fetchShow(p)).state)[0]));
  assert.ok(states.every((s) => s === "settled" || s === "cancelled"), `every show reached the end: ${states}`);
  assert.ok(states.includes("settled"), "at least one show was played and paid out");
  assert.ok(chain.calls.filter(([n]) => n === "registerVenue").length >= 2, "missing venues were registered");
});
