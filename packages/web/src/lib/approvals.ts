import { buildRoute, buildVenueChoices, deriveApprovals, type ApprovalItem } from "@greenroom/agents/approvals";
import type { PlannedShow, VenueOffer } from "@greenroom/agents/planner";

export type ApprovalView = ApprovalItem & {
  /** Reconstructed from a run recorded before band approvals existed. */
  legacy?: boolean;
};

export interface ApprovalsView {
  items: ApprovalView[];
  /** The server can pass decisions to a running agent (Node server with a live run). */
  writable: boolean;
  /** Ids the band answered that the agent has not picked up yet. */
  sent: string[];
}

interface MessageLike {
  kind: string;
  at: number;
  data?: unknown;
}

/**
 * Approvals from a transcript. Runs recorded before approvals existed have no
 * approval messages; for those the venue offers and the band's plan are shown
 * as auto-pilot decisions so the history still reads correctly.
 */
export function approvalsFromMessages(messages: MessageLike[]): ApprovalView[] {
  const items = deriveApprovals(messages);
  if (items.length) return items;

  const request = messages.find((m) => m.kind === "tour.request");
  const offerMsgs = messages.filter((m) => m.kind === "venue.offer" && m.data);
  const planMsg = messages.find((m) => m.kind === "band.plan");
  const req = request?.data as { genre: string; draw: number; targetPriceLamports: number } | undefined;
  const offers = offerMsgs.map((m) => m.data as VenueOffer);
  const plan = (planMsg?.data as { plan?: PlannedShow[] } | undefined)?.plan ?? [];
  if (!req || !planMsg || offers.length === 0 || plan.length === 0) return [];

  const band = { genre: req.genre as never, draw: req.draw, targetPriceLamports: req.targetPriceLamports, homeCity: "" };
  const choices = buildVenueChoices(band, offers, plan, undefined, plan.length);
  const allIds = offers.map((o) => o.venueId);
  const { stops, summary } = buildRoute(plan, offers);
  const offeredAt = offerMsgs[offerMsgs.length - 1].at;
  return [
    {
      legacy: true,
      request: {
        id: "venues",
        mode: "auto",
        title: "Approve venues",
        payload: { step: "venues", homeCity: "", wantedShows: plan.length, offers: choices, planning: { band, windowDays: 21, thresholdBps: plan[0].thresholdBps, capacityScale: 0.05, minCapacity: 12 } },
        recommended: { step: "venues", approve: true, venueIds: allIds },
      },
      requestedAt: offeredAt,
      decision: { id: "venues", by: "auto-pilot", answer: { step: "venues", approve: true, venueIds: allIds } },
      decidedAt: offeredAt,
    },
    {
      legacy: true,
      request: {
        id: "route-1",
        mode: "auto",
        title: "Approve the route",
        payload: { step: "route", round: 1, stops, summary },
        recommended: { step: "route", approve: true, dropVenueIds: [] },
      },
      requestedAt: planMsg.at,
      decision: { id: "route-1", by: "auto-pilot", answer: { step: "route", approve: true, dropVenueIds: [] } },
      decidedAt: planMsg.at,
    },
  ];
}

/** Items still waiting for the band. */
export function pendingItems(view: ApprovalsView | null): ApprovalView[] {
  return view ? view.items.filter((i) => !i.decision) : [];
}
