import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { findAlternatives } from "./alternatives.ts";
import { buildRoute, buildVenueChoices, checkAnswer, deriveApprovals, type ApprovalRequest } from "./approvals.ts";
import { AutoApprover, FileApprover } from "./approver.ts";
import { planTour, type VenueOffer } from "./planner.ts";

const band = { genre: "rock" as const, draw: 400, targetPriceLamports: 10, homeCity: "Berlin" };
const cities = [{ name: "Berlin", country: "DE" as const, lat: 52.52, lng: 13.405 }];

function offer(id: string, city: string, lat: number, lng: number, cap = 400, days: number[] = [...Array(21).keys()]): VenueOffer {
  return { venueId: id, venueName: id.toUpperCase(), venuePubkey: id, city, country: "DE", capacity: cap, offeredCapacity: cap, askBps: 3000, minPriceLamports: 10, availableDays: days, lat, lng, genres: ["rock"] };
}

const offers = [
  offer("lido", "Berlin", 52.499, 13.445),
  offer("so36", "Berlin", 52.5, 13.422, 300),
  offer("conne", "Leipzig", 51.31, 12.37),
  offer("werk2", "Leipzig", 51.31, 12.39, 500),
  offer("roxy", "Prague", 50.09, 14.43),
  offer("arena", "Vienna", 48.19, 16.41),
  offer("ampere", "Munich", 48.13, 11.6),
  offer("wiesbaden", "Wiesbaden", 50.08, 8.24, 2000),
];

test("venue choices recommend the planned venues plus backups, with drive from home", () => {
  const plan = planTour({ band, offers, cities, wantedShows: 4, windowDays: 21, capacityScale: 0.05, minCapacity: 12 });
  const choices = buildVenueChoices(band, offers, plan, cities[0], 4);
  assert.equal(choices.length, offers.length);
  for (const p of plan) assert.ok(choices.find((c) => c.venueId === p.venueId)?.recommended, `${p.venueId} recommended`);
  assert.ok(choices.filter((c) => c.recommended).length > plan.length, "backups are recommended too");
  const prague = choices.find((c) => c.venueId === "roxy")!;
  assert.ok(prague.fromHomeKm > 300 && prague.fromHomeKm < 400, `Berlin to Prague by road: ${prague.fromHomeKm}`);
  assert.ok(choices.every((c, i) => i === 0 || choices[i - 1].score >= c.score), "sorted by fit");
});

test("route has legs, days off and money", () => {
  const plan = planTour({ band, offers, cities, wantedShows: 5, windowDays: 21, capacityScale: 0.05, minCapacity: 12 });
  const { stops, summary } = buildRoute(plan, offers);
  assert.equal(stops.length, plan.length);
  assert.equal(stops[0].driveKm, 0);
  assert.ok(stops.slice(1).every((s) => s.driveKm > 0 && s.driveMinutes > 0));
  assert.equal(summary.km, stops.reduce((s, x) => s + x.driveKm, 0));
  assert.ok(summary.bandAtSelloutLamports > 0 && summary.bandAtSelloutLamports < summary.grossAtSelloutLamports);
  assert.ok(summary.grossAtThresholdLamports < summary.grossAtSelloutLamports);
});

function venuesRequest(): ApprovalRequest {
  const choices = buildVenueChoices(band, offers, [], cities[0], 4);
  return { id: "venues", mode: "dashboard", title: "t", payload: { step: "venues", homeCity: "Berlin", wantedShows: 4, offers: choices }, recommended: { step: "venues", approve: true, venueIds: ["lido"] } };
}

test("checkAnswer validates answers coming from the dashboard", () => {
  const req = venuesRequest();
  assert.deepEqual(checkAnswer(req, { step: "venues", approve: true, venueIds: ["lido", "lido", "roxy"] }), { answer: { step: "venues", approve: true, venueIds: ["lido", "roxy"] } });
  assert.ok("error" in checkAnswer(req, { step: "venues", approve: true, venueIds: ["nope"] }));
  assert.ok("error" in checkAnswer(req, { step: "venues", approve: true, venueIds: [] }));
  assert.ok("error" in checkAnswer(req, { step: "route", approve: true, dropVenueIds: [] }));
  assert.ok("error" in checkAnswer(req, null));
  assert.deepEqual(checkAnswer(req, { step: "venues", approve: false, venueIds: ["lido"] }), { answer: { step: "venues", approve: false, venueIds: [] } });

  const plan = planTour({ band, offers, cities, wantedShows: 3, windowDays: 21 });
  const { stops, summary } = buildRoute(plan, offers);
  const route: ApprovalRequest = { id: "route-1", mode: "dashboard", title: "t", payload: { step: "route", round: 1, stops, summary }, recommended: { step: "route", approve: true, dropVenueIds: [] } };
  assert.ok("answer" in checkAnswer(route, { step: "route", approve: false, dropVenueIds: [stops[0].venueId] }));
  assert.ok("error" in checkAnswer(route, { step: "route", approve: true, dropVenueIds: [stops[0].venueId] }), "approve means as is");
  assert.ok("error" in checkAnswer(route, { step: "route", approve: false, dropVenueIds: stops.map((s) => s.venueId) }), "cannot drop everything");
});

test("file approver picks up the dashboard's decision; auto-pilot takes the recommendation", async () => {
  const req = venuesRequest();
  assert.deepEqual((await new AutoApprover().decide(req)).answer, req.recommended);

  const file = join(mkdtempSync(join(tmpdir(), "greenroom-")), "decisions.jsonl");
  const approver = new FileApprover(file, 20);
  const pending = approver.decide(req);
  writeFileSync(file, `{"id":"venues","answer":{"step":"venues","approve":true,"venueIds":["nope"]}}\n{"id":"other"}\n{"id":"venues","answer":{"step":"venues","approve":true,"venueIds":["roxy"]}}\n`);
  const d = await pending;
  assert.equal(d.by, "you");
  assert.deepEqual(d.answer, { step: "venues", approve: true, venueIds: ["roxy"] }, "invalid lines are skipped");

  const expired = await approver.decide({ ...req, id: "late", expiresAt: Date.now() + 30 });
  assert.equal(expired.by, "expired");
  assert.equal(expired.answer.approve, false);

  const ac = new AbortController();
  const aborted = approver.decide({ ...req, id: "never" }, ac.signal);
  ac.abort();
  assert.equal((await aborted).by, "expired");
});

test("deriveApprovals pairs requests with decisions", () => {
  const req = venuesRequest();
  const items = deriveApprovals([
    { kind: "note", at: 1 },
    { kind: "approval.request", at: 2, data: req },
    { kind: "approval.request", at: 3, data: { ...req, id: "route-1" } },
    { kind: "approval.decision", at: 4, data: { id: "venues", answer: req.recommended, by: "you" } },
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].decision?.by, "you");
  assert.equal(items[0].decidedAt, 4);
  assert.equal(items[1].decision, undefined);
});

test("alternatives: downsize first, then a smaller room in town, then a nearby city; route order kept", () => {
  const route = [
    { venueId: "conne", city: "Leipzig", day: 0, lat: 51.31, lng: 12.37 },
    { venueId: "roxy", city: "Prague", day: 4, lat: 50.09, lng: 14.43 },
  ];
  const opts = findAlternatives({
    band,
    cancelled: { venueId: "lido", city: "Berlin", day: 2, capacity: 20, ticketsSold: 4, thresholdBps: 5000 },
    offers,
    route,
    windowDays: 21,
    capacityScale: 0.05,
    minCapacity: 12,
  });
  assert.ok(opts.length >= 2);
  assert.equal(opts[0].kind, "downsize");
  assert.equal(opts[0].venueId, "lido");
  assert.equal(opts[0].day, 2);
  assert.ok(opts[0].capacity < 20 && opts[0].required < 10);
  const sameCity = opts.find((o) => o.kind === "same-city");
  assert.equal(sameCity?.venueId, "so36", "smaller Berlin room");
  for (const o of opts) {
    assert.ok(o.day > 0 && o.day < 4, "between the neighbouring shows");
    assert.ok(!["Leipzig", "Prague"].includes(o.city), "not a city already on the route");
    assert.equal(o.bandBps + o.venueBps, 10_000);
  }
  assert.ok(!opts.some((o) => o.venueId === "wiesbaden"), "too far off the route");

  const none = findAlternatives({
    band,
    cancelled: { venueId: "lido", city: "Berlin", day: 2, capacity: 12, ticketsSold: 1, thresholdBps: 5000 },
    offers: [offer("lido", "Berlin", 52.499, 13.445)],
    route,
    windowDays: 21,
    capacityScale: 0.05,
    minCapacity: 12,
  });
  assert.equal(none.length, 0, "cannot downsize below the minimum and nothing else was approved");
});
