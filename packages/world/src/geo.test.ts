import assert from "node:assert/strict";
import { test } from "node:test";
import { drive, driveMinutesForKm, formatMinutes, legs, optimizeOrder, routeTotals } from "./geo.ts";

const berlin = { lat: 52.52, lng: 13.405 };
const munich = { lat: 48.1351, lng: 11.582 };
const leipzig = { lat: 51.3397, lng: 12.3731 };
const paris = { lat: 48.8566, lng: 2.3522 };

test("drive estimates road km and van time with breaks", () => {
  const d = drive(berlin, munich);
  // real road distance is ~585 km; the estimate should be in that neighbourhood
  assert.ok(d.km > 560 && d.km < 640, `km ${d.km}`);
  // ~7 h of wheel time plus one 45-minute break
  assert.ok(d.minutes > 7 * 60 && d.minutes < 9 * 60, `minutes ${d.minutes}`);
  assert.equal(d.level, "long");
  assert.equal(drive(berlin, leipzig).level, "short");
  assert.equal(drive(berlin, paris).level, "travel-day");
  assert.equal(driveMinutesForKm(0), 0);
  assert.equal(formatMinutes(45), "45m");
  assert.equal(formatMinutes(185), "3h 05m");
});

test("optimizeOrder keeps the start and avoids zig-zags", () => {
  const pts = [berlin, munich, leipzig, paris];
  const order = optimizeOrder(pts, 0);
  assert.equal(order[0], 0);
  assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
  const zigzag = routeTotals(legs([berlin, munich, leipzig, paris])).km;
  const optimized = routeTotals(legs(order.map((i) => pts[i]))).km;
  assert.ok(optimized < zigzag, `${optimized} < ${zigzag}`);
});
