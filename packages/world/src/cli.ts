import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateWorld } from "./generate.ts";

/**
 * Dumps the generated world to data/world.json so the dashboard and the QA
 * checks can read it without re-generating. Usage: npm run generate -w @greenroom/world
 */
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../../data/world.json");
const world = generateWorld();
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(world, null, 2));
console.log(
  `wrote ${out}: ${world.cities.length} cities, ${world.venues.length} venues, ${world.bands.length} bands, ${world.crew.length} crew, ${world.fans.length} fans`
);
