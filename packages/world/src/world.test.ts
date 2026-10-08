import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { DEFAULT_VENUES_PATH, distanceKm, generateWorld, Rng } from "./index.ts";

test("rng is deterministic", () => {
  const a = new Rng("x");
  const b = new Rng("x");
  assert.equal(a.next(), b.next());
  assert.equal(a.int(1, 10), b.int(1, 10));
  assert.equal(a.seedHex("l"), b.seedHex("l"));
});

test("distance Berlin to Prague is roughly 280 km", () => {
  const d = distanceKm({ lat: 52.52, lng: 13.405 }, { lat: 50.0755, lng: 14.4378 });
  assert.ok(d > 250 && d < 300, `got ${d}`);
});

test("world generates the requested scale with unique bands", { skip: !existsSync(DEFAULT_VENUES_PATH) }, () => {
  const w = generateWorld({ bands: 100, crewPerCity: 100, fansPerCity: 50 });
  assert.equal(w.bands.length, 100);
  assert.equal(new Set(w.bands.map((b) => b.name)).size, 100);
  assert.ok(w.bands.every((b) => b.name.length <= 32));
  assert.equal(w.crew.length, w.cities.length * 100);
  assert.ok(w.fans.length >= w.cities.length * 8, "fans scale with city population");
  const berlin = w.fans.filter((f) => f.city === "Berlin").length;
  const salzburg = w.fans.filter((f) => f.city === "Salzburg").length;
  assert.ok(berlin > salzburg, `big cities have more fans (${berlin} vs ${salzburg})`);
  assert.ok(w.venues.length >= w.cities.length * 2, "at least two venues per city");
  for (const v of w.venues) {
    assert.ok(v.capacity > 50 && v.capacity < 20000, `${v.name} capacity ${v.capacity}`);
    assert.ok(v.lat > 41 && v.lat < 56 && v.lng > -6 && v.lng < 25, `${v.name} coordinates`);
    assert.ok(w.cities.some((c) => c.name === v.city), `${v.name} city ${v.city} is in cities`);
  }
  const again = generateWorld({ bands: 100, crewPerCity: 100, fansPerCity: 50 });
  assert.deepEqual(again.bands[0], w.bands[0]);
});
