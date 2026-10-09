/**
 * Dev aid: run one tour against the in-memory FakeChain and write the run to
 * data/runs/<id>/ like a real run, so the dashboard can be exercised without a
 * validator. Show accounts and transaction links will not resolve on any
 * cluster. Usage: tsx src/testing/simulate.ts [--approve] [--empty-first]
 * (--empty-first: no fan buys for the first city, so a replacement is offered)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateWorld } from "@greenroom/world";
import { keypairFromSeedHex, venuePda } from "@greenroom/sdk";
import { AutoApprover, FileApprover } from "../approver.ts";
import { BandAgent, type TourBrief } from "../band-agent.ts";
import { HeuristicBrain } from "../brain.ts";
import { MessageBus } from "../bus.ts";
import { Crank } from "../crank.ts";
import { FanSim } from "../fan-sim.ts";
import { runTour } from "../orchestrator.ts";
import { VenueAgent } from "../venue-agent.ts";
import { FakeChain } from "./fake-chain.ts";

const approve = process.argv.includes("--approve");
// ISO first so it sorts with real runs (the dashboard shows the newest folder).
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-sim`;
const runDir = join(resolve(dirname(fileURLToPath(import.meta.url)), "../../../../data/runs"), runId);
mkdirSync(runDir, { recursive: true });

const world = generateWorld({ seed: "greenroom-2026", fansPerCity: 60, crewPerCity: 100, basePriceLamports: 10_000_000 });
const band = world.bands[0];
const countries = ["DE", "AT", "FR", "PL", "CZ"];
const brief: TourBrief = { countries, wantedShows: 8, windowDays: 21, thresholdBps: 5000, deadlineAfterSec: 40, showAfterSec: 75, capacityScale: 0.05, minCapacity: 12, tourName: `${band.name} Central Europe`.slice(0, 32), region: "Central EU" };
const chain = new FakeChain(Number(process.env.SIM_SPEED ?? 1));
const bus = new MessageBus({ file: join(runDir, "transcript.jsonl") });
bus.on("*", (m) => console.log(`[${m.kind}] ${m.from}${m.to ? ` -> ${m.to}` : ""}: ${m.text}`));
const brain = new HeuristicBrain();
const agents = world.venues
  .filter((v) => countries.includes(v.country))
  .map((v) => {
    const kp = keypairFromSeedHex(v.seed);
    const profile = venuePda(kp.publicKey, chain.programId);
    chain.registerVenue_(kp.publicKey, profile, v.capacity);
    const a = new VenueAgent(v, kp, profile, chain.client, bus, brain);
    a.start();
    return a;
  });
const bandKp = keypairFromSeedHex(band.seed);
const bandAgent = new BandAgent(band, bandKp, chain.client, bus, brain, world.cities);
let emptyCity: string | null = null;
if (process.argv.includes("--empty-first")) bus.on("band.plan", (m) => (emptyCity ??= (m.data as { plan: { city: string }[] }).plan[0]?.city ?? null));
class Fans extends FanSim {
  override tick(views: Parameters<FanSim["tick"]>[0]) {
    return super.tick(views.filter((v) => v.booked.replaces || v.booked.city !== emptyCity));
  }
}
const out = await runTour(brief, {
  hub: bandKp.publicKey,
  connection: { getBalance: async () => 100e9 },
  bandAgent,
  crank: new Crank(chain.client, bus),
  fans: new Fans(band, world.fans, world.cities, chain.client, bus, { maxBuysPerTick: 40, radiusKm: 80, seed: "greenroom-2026", concurrency: 6 }),
  bus,
  client: chain.client,
  world,
  crewAddress: (c) => keypairFromSeedHex(c.seed).publicKey.toBase58(),
  log: console.log,
  tickMs: 1000,
  collectMs: 500,
  hireCrew: true,
  approver: approve ? new FileApprover(join(runDir, "decisions.jsonl")) : new AutoApprover(),
  replacementTimeoutSec: 300,
});
agents.forEach((a) => a.stop());
writeFileSync(
  join(runDir, "summary.json"),
  JSON.stringify(
    {
      runId,
      cluster: "simulated",
      band: { id: band.id, name: band.name, authority: bandKp.publicKey.toBase58(), profile: bandAgent.bandProfile.toBase58(), homeCity: band.homeCity, genre: band.genre, draw: band.draw },
      brief: { countries, wantedShows: brief.wantedShows, windowDays: brief.windowDays },
      approvals: approve ? "dashboard" : "auto",
      tour: out.tour?.toBase58() ?? "",
      shows: out.shows,
      stats: { ...out.stats, messages: bus.log.length, brain: brain.name },
    },
    null,
    2
  )
);
console.log(`simulated run written to ${runDir}: ${JSON.stringify(out.stats)}`);
