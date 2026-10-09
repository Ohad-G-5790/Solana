#!/usr/bin/env node
/**
 * Writes src/lib/borders.json: European country outlines for the dashboard
 * maps, from Natural Earth 1:50m (public domain) via the world-atlas package.
 * Polygons outside Europe (overseas territories) are dropped, points far
 * outside the map are clamped to its edge (only off-screen shape changes),
 * coordinates are rounded to 0.01° and thinned so the file stays small.
 *
 *   npm i --no-save world-atlas@2 topojson-client@3 && node scripts/build-borders.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { feature } = require("topojson-client");
const topo = JSON.parse(readFileSync(require.resolve("world-atlas/countries-50m.json"), "utf8"));
const BOX = { minLng: -12, maxLng: 32, minLat: 35, maxLat: 61 };
const CLAMP = { minLng: BOX.minLng - 2, maxLng: BOX.maxLng + 2, minLat: BOX.minLat - 2, maxLat: BOX.maxLat + 2 };
const MIN_STEP = 0.05; // degrees between kept points

const inBox = ([lng, lat]) => lng >= BOX.minLng && lng <= BOX.maxLng && lat >= BOX.minLat && lat <= BOX.maxLat;
const round = (x) => Math.round(x * 100) / 100;

const clamp = ([lng, lat]) => [Math.min(CLAMP.maxLng, Math.max(CLAMP.minLng, lng)), Math.min(CLAMP.maxLat, Math.max(CLAMP.minLat, lat))];

function thin(ring) {
  const out = [];
  for (const p of ring.map(clamp)) {
    const last = out[out.length - 1];
    if (!last || Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) >= MIN_STEP) out.push([round(p[0]), round(p[1])]);
  }
  return out.length >= 4 ? out : null;
}

const countries = [];
for (const f of feature(topo, topo.objects.countries).features) {
  const g = f.geometry;
  if (!g) continue;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  const rings = [];
  for (const poly of polys) {
    const outer = poly[0];
    if (!outer.some(inBox)) continue; // overseas territory or outside the map
    const r = thin(outer);
    if (r) rings.push(r);
  }
  if (rings.length) countries.push({ name: f.properties.name, rings });
}
countries.sort((a, b) => a.name.localeCompare(b.name));
const out = join(dirname(fileURLToPath(import.meta.url)), "../src/lib/borders.json");
writeFileSync(out, JSON.stringify({ source: "Natural Earth 1:50m via world-atlas 2.0.2 (public domain)", countries }));
console.log(`${countries.length} countries -> ${out}`);
