import assert from "node:assert/strict";
import { test } from "node:test";
import { generateWorld } from "@greenroom/world";
import { planTour, scoreOffer, venueAvailability, type VenueOffer } from "./planner.ts";
import { HeuristicBrain } from "./brain.ts";
import { MessageBus } from "./bus.ts";

const world = generateWorld({ bands: 5, crewPerCity: 2, fansPerCity: 2 });
const band = { ...world.bands[0], draw: 400, genre: "rock" as const, homeCity: "Berlin" };

function offerFor(id: string, city: string, country: string, cap: number, lat: number, lng: number, askBps = 3000): VenueOffer {
  return { venueId: id, venuePubkey: id, city, country, capacity: cap, offeredCapacity: cap, askBps, minPriceLamports: 1, availableDays: [...Array(21).keys()], lat, lng, genres: ["rock"] };
}

test("scoreOffer prefers fitting capacity and lower share", () => {
  const good = offerFor("a", "Berlin", "DE", 420, 52.5, 13.4, 2500);
  const big = offerFor("b", "Berlin", "DE", 3000, 52.5, 13.4, 2500);
  const greedy = offerFor("c", "Berlin", "DE", 420, 52.5, 13.4, 4000);
  assert.ok(scoreOffer(band, good) > scoreOffer(band, big));
  assert.ok(scoreOffer(band, good) > scoreOffer(band, greedy));
});

test("planTour orders cities geographically and respects rest days", () => {
  const offers = [
    offerFor("prague", "Prague", "CZ", 500, 50.08, 14.43),
    offerFor("vienna", "Vienna", "AT", 450, 48.21, 16.37),
    offerFor("berlin", "Berlin", "DE", 400, 52.52, 13.4),
    offerFor("paris", "Paris", "FR", 420, 48.86, 2.35),
    offerFor("warsaw", "Warsaw", "PL", 480, 52.23, 21.01),
    offerFor("munich", "Munich", "DE", 400, 48.14, 11.58),
  ];
  const plan = planTour({ band, offers, cities: world.cities, wantedShows: 6, windowDays: 21, capacityScale: 1 });
  assert.equal(plan.length, 6);
  assert.equal(plan[0].city, "Berlin", "starts near home");
  const days = plan.map((p) => p.day);
  assert.ok(days.every((d, i) => i === 0 || d > days[i - 1]), "days strictly increase");
  assert.ok(days[3] - days[2] >= 2, "rest day after three shows");
  const total = plan.reduce((s, p) => s + p.distanceFromPrevKm, 0);
  assert.ok(total < 3500, `route is reasonably short: ${total} km`);
  assert.ok(plan.every((p) => p.bandBps + p.venueBps === 10_000));
});

test("venueAvailability is deterministic and leaves free days", () => {
  const v = world.venues[0];
  const a = venueAvailability(v, 21);
  const b = venueAvailability(v, 21);
  assert.deepEqual(a, b);
  assert.ok(a.length >= 8);
});

test("heuristic brain returns the heuristic answer", async () => {
  const brain = new HeuristicBrain();
  const d = await brain.decide<number>({ agent: "t", title: "t", system: "", prompt: "", schema: {}, heuristic: () => ({ value: 42, reasoning: "because" }) });
  assert.equal(d.value, 42);
  assert.equal(d.source, "heuristic");
});

test("bus collects targeted messages and logs everything", async () => {
  const bus = new MessageBus();
  const p = bus.collect("venue.offer", 50, "band:x");
  bus.publish({ kind: "venue.offer", from: "venue:a", to: "band:x", text: "offer" });
  bus.publish({ kind: "venue.offer", from: "venue:b", to: "band:y", text: "other" });
  const got = await p;
  assert.equal(got.length, 1);
  assert.equal(bus.log.length, 2);
});

import { ClaudeBrain } from "./brain.ts";

function fakeClient(reply: string | Error) {
  return {
    messages: {
      create: async () => {
        if (reply instanceof Error) throw reply;
        return { content: [{ type: "text", text: reply }] };
      },
    },
  };
}
const brainTask = (validate?: (v: { pick: string }) => string | null) => ({
  agent: "t",
  title: "t",
  system: "s",
  prompt: "p",
  schema: { pick: "string" },
  heuristic: () => ({ value: { pick: "baseline" }, reasoning: "base" }),
  validate,
});

test("claude brain uses a valid model answer", async () => {
  const brain = new ClaudeBrain({ client: fakeClient('{"pick":"model","reasoning":"because"}') });
  const d = await brain.decide(brainTask());
  assert.equal(d.value.pick, "model");
  assert.equal(d.source, "claude");
});

test("claude brain falls back to the heuristic on bad JSON, API errors and rejected answers", async () => {
  const bad = await new ClaudeBrain({ client: fakeClient("not json at all") }).decide(brainTask());
  assert.equal(bad.value.pick, "baseline");
  assert.equal(bad.source, "heuristic");
  const err = await new ClaudeBrain({ client: fakeClient(new Error("429")) }).decide(brainTask());
  assert.equal(err.source, "heuristic");
  const rejected = await new ClaudeBrain({ client: fakeClient('{"pick":"model"}') }).decide(brainTask((v) => (v.pick === "model" ? "not allowed" : null)));
  assert.equal(rejected.value.pick, "baseline");
  assert.equal(rejected.source, "heuristic");
});
