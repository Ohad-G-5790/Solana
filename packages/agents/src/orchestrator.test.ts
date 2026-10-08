import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { generateWorld } from "@greenroom/world";
import { keypairFromSeedHex, venuePda } from "@greenroom/sdk";
import type { ApprovalAnswer, ApprovalRequest } from "./approvals.ts";
import { AutoApprover, FileApprover, type Approver } from "./approver.ts";
import { BandAgent, type TourBrief } from "./band-agent.ts";
import { HeuristicBrain } from "./brain.ts";
import { MessageBus, type BusMessage } from "./bus.ts";
import { Crank } from "./crank.ts";
import { FanSim } from "./fan-sim.ts";
import { runTour } from "./orchestrator.ts";
import { FakeChain } from "./testing/fake-chain.ts";
import { VenueAgent } from "./venue-agent.ts";

const world = generateWorld({ seed: "greenroom-2026", fansPerCity: 60, crewPerCity: 8, basePriceLamports: 10_000_000 });
const band = world.bands[0];

const brief: TourBrief = {
  countries: ["DE", "CZ", "AT", "PL"],
  wantedShows: 5,
  windowDays: 21,
  thresholdBps: 5000,
  deadlineAfterSec: 30,
  showAfterSec: 50,
  capacityScale: 0.05,
  minCapacity: 12,
  tourName: "Test tour",
  region: "Central EU",
};

/** Fans who never show up in one city (for the first booking there), so a cancellation is certain. */
class FansSkipping extends FanSim {
  skipCity: string | null = null;
  override tick(views: Parameters<FanSim["tick"]>[0]) {
    return super.tick(views.filter((v) => v.booked.replaces || v.booked.city !== this.skipCity));
  }
}

function setup(approver: Approver) {
  const chain = new FakeChain(10);
  const bus = new MessageBus();
  const brain = new HeuristicBrain();
  const venueAgents = world.venues
    .filter((v) => brief.countries.includes(v.country))
    .map((v) => {
      const kp = keypairFromSeedHex(v.seed);
      const profile = venuePda(kp.publicKey, chain.programId);
      chain.registerVenue(kp.publicKey, profile, v.capacity);
      const a = new VenueAgent(v, kp, profile, chain.client, bus, brain);
      a.start();
      return a;
    });
  const bandAgent = new BandAgent(band, keypairFromSeedHex(band.seed), chain.client, bus, brain, world.cities);
  const fans = new FansSkipping(band, world.fans, world.cities, chain.client, bus, { maxBuysPerTick: 40, radiusKm: 80, seed: "test", concurrency: 6 });
  bus.on("band.plan", (m) => {
    fans.skipCity ??= (m.data as { plan: { city: string }[] }).plan[0]?.city ?? null;
  });
  const run = () =>
    runTour(brief, {
      hub: bandAgent.keypair.publicKey,
      connection: { getBalance: async () => 100e9 },
      bandAgent,
      crank: new Crank(chain.client, bus),
      fans,
      bus,
      client: chain.client,
      world,
      crewAddress: (c) => keypairFromSeedHex(c.seed).publicKey.toBase58(),
      log: () => {},
      tickMs: 100,
      collectMs: 200,
      hireCrew: true,
      approver,
      replacementTimeoutSec: 5,
    }).finally(() => venueAgents.forEach((a) => a.stop()));
  return { chain, bus, run };
}

const kinds = (log: BusMessage[]) => log.map((m) => m.kind);
const idOf = (m: BusMessage) => (m.data as { id: string }).id;

test("auto-pilot: venues and route approved before anything is proposed; a cancelled show gets a replacement", { timeout: 60_000 }, async () => {
  const { chain, bus, run } = setup(new AutoApprover());
  const out = await run();

  const log = bus.log;
  const firstProposal = kinds(log).indexOf("show.proposed");
  const requests = log.filter((m) => m.kind === "approval.request");
  const decisions = log.filter((m) => m.kind === "approval.decision");
  assert.deepEqual(requests.slice(0, 2).map(idOf), ["venues", "route-1"]);
  assert.ok(decisions.length === requests.length && decisions.every((m) => m.from === "auto-pilot"));
  assert.ok(log.indexOf(decisions[1]) < firstProposal, "route approved before the first proposal");

  assert.ok(out.stats.cancelled >= 1, `a show was cancelled: ${JSON.stringify(out.stats)}`);
  assert.ok(out.stats.replacements >= 1, "a replacement was booked");
  const replacement = out.shows.find((s) => s.replaces);
  const original = out.shows.find((s) => s.show === replacement?.replaces);
  assert.ok(replacement && original, "replacement links to the cancelled show");
  assert.equal(original.state, "cancelled");
  assert.equal(original.replacedBy, replacement.show);
  assert.ok(requests.some((m) => idOf(m).startsWith("alt-")), "the band was asked about the replacement");
  assert.ok(["confirmed", "settled", "cancelled"].includes(replacement.state), `replacement reached a decision: ${replacement.state}`);
  assert.ok(out.shows.every((s) => ["settled", "cancelled", "rejected"].includes(s.state)), "every show is terminal");
  assert.ok(out.stats.settled >= 1, "some shows settled");
  assert.ok(chain.calls.some(([n]) => n === "refundTicket") || original.ticketsSold === 0, "cancelled tickets refunded");
});

test("dashboard: the band drops a stop, approves the re-plan; nothing is on-chain before that", { timeout: 60_000 }, async () => {
  const file = join(mkdtempSync(join(tmpdir(), "greenroom-")), "decisions.jsonl");
  const { chain, bus, run } = setup(new FileApprover(file, 20));
  let dropped = "";
  let callsAtFinalApproval = -1;
  bus.on<ApprovalRequest>("approval.request", (m) => {
    const req = m.data!;
    let answer: ApprovalAnswer;
    if (req.payload.step === "venues") {
      answer = { step: "venues", approve: true, venueIds: req.recommended.step === "venues" ? req.recommended.venueIds : [] };
    } else if (req.payload.step === "route" && req.payload.round === 1) {
      dropped = req.payload.stops[1].venueId;
      answer = { step: "route", approve: false, dropVenueIds: [dropped] };
    } else if (req.payload.step === "route") {
      callsAtFinalApproval = chain.calls.length;
      answer = { step: "route", approve: true, dropVenueIds: [] };
    } else {
      answer = { step: "alternative", approve: false, optionId: null };
    }
    setTimeout(() => appendFileSync(file, JSON.stringify({ id: req.id, answer }) + "\n"), 50);
  });
  const out = await run();

  assert.equal(callsAtFinalApproval, 0, "no transaction before the band approved the route");
  const decisions = bus.log.filter((m) => m.kind === "approval.decision");
  assert.ok(decisions.every((m) => m.from === "you"), "decisions came from the dashboard");
  assert.ok(bus.log.some((m) => m.kind === "approval.request" && idOf(m) === "route-2"), "re-planned after the drop");
  assert.ok(out.tour, "booked after approval");
  assert.ok(!out.shows.some((s) => s.venue === dropped), "dropped venue is not on the tour");
  assert.equal(out.stats.replacements, 0, "the band said no to replacements");
});

test("dashboard: declining the route books nothing", { timeout: 30_000 }, async () => {
  const file = join(mkdtempSync(join(tmpdir(), "greenroom-")), "decisions.jsonl");
  const { chain, bus, run } = setup(new FileApprover(file, 20));
  bus.on<ApprovalRequest>("approval.request", (m) => {
    const req = m.data!;
    const answer = req.payload.step === "venues" ? req.recommended : { step: "route", approve: false, dropVenueIds: [] };
    appendFileSync(file, JSON.stringify({ id: req.id, answer }) + "\n");
  });
  const out = await run();
  assert.equal(out.tour, null);
  assert.equal(out.shows.length, 0);
  assert.equal(chain.calls.length, 0, "no transactions at all");
});
