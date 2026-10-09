/**
 * Writes packages/web/public/venue-profiles.json: each seed venue's agent
 * wallet and on-chain VenueProfile address (public keys only), so the
 * dashboard can propose shows to them from the band's own wallet.
 *
 *   npx tsx src/export-venue-profiles.ts
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateWorld } from "@greenroom/world";
import { keypairFromSeedHex, PROGRAM_ID, venuePda } from "@greenroom/sdk";

// Venue wallets depend only on the world seed (venues are seeded first).
const world = generateWorld({ seed: "greenroom-2026", bands: 1, crewPerCity: 1, fansPerCity: 1 });
const venues: Record<string, { authority: string; profile: string }> = {};
for (const v of world.venues) {
  const authority = keypairFromSeedHex(v.seed).publicKey;
  venues[v.id] = { authority: authority.toBase58(), profile: venuePda(authority, PROGRAM_ID).toBase58() };
}
const out = resolve(dirname(fileURLToPath(import.meta.url)), "../../web/public/venue-profiles.json");
writeFileSync(out, JSON.stringify({ programId: PROGRAM_ID.toBase58(), seed: "greenroom-2026", venues }, null, 1) + "\n");
console.log(`${Object.keys(venues).length} venues -> ${out}`);
