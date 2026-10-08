import { existsSync, readFileSync } from "node:fs";
import { checkAnswer, declineAnswer, describeDecision, type ApprovalAnswer, type ApprovalDecision, type ApprovalMode, type ApprovalRequest } from "./approvals.ts";
import type { MessageBus } from "./bus.ts";

/** Who answers the band agent's questions. */
export interface Approver {
  readonly mode: ApprovalMode;
  /** Resolves with the decision. Aborting the signal (the run is ending) declines as expired. */
  decide(req: ApprovalRequest, signal?: AbortSignal): Promise<ApprovalDecision>;
}

/** Auto-pilot: approves exactly what the agent recommends. Used by tests, the QA bot and `demo:fast`. */
export class AutoApprover implements Approver {
  readonly mode = "auto" as const;
  async decide(req: ApprovalRequest): Promise<ApprovalDecision> {
    return { id: req.id, answer: req.recommended, by: "auto-pilot" };
  }
}

/**
 * The band decides in the dashboard. The dashboard's POST /api/approvals
 * appends `{"id": ..., "answer": {...}}` lines to `decisions.jsonl` in the run
 * folder; this polls that file. Lines that do not validate are ignored.
 */
export class FileApprover implements Approver {
  readonly mode = "dashboard" as const;
  constructor(
    readonly file: string,
    private readonly pollMs = 500
  ) {}

  decide(req: ApprovalRequest, signal?: AbortSignal): Promise<ApprovalDecision> {
    return new Promise((resolve) => {
      const finish = (d: ApprovalDecision) => {
        clearInterval(timer);
        signal?.removeEventListener("abort", onAbort);
        resolve(d);
      };
      const expire = () => finish({ id: req.id, answer: declineAnswer(req), by: "expired" });
      const onAbort = () => expire();
      const poll = () => {
        const answer = this.read(req);
        if (answer) finish({ id: req.id, answer, by: "you" });
        else if (req.expiresAt && Date.now() >= req.expiresAt) expire();
      };
      const timer = setInterval(poll, this.pollMs);
      if (signal?.aborted) return expire();
      signal?.addEventListener("abort", onAbort, { once: true });
      poll();
    });
  }

  private read(req: ApprovalRequest): ApprovalAnswer | null {
    if (!existsSync(this.file)) return null;
    let text: string;
    try {
      text = readFileSync(this.file, "utf8");
    } catch {
      return null;
    }
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line) as { id?: unknown; answer?: unknown };
        if (row.id !== req.id) continue;
        const checked = checkAnswer(req, row.answer);
        if ("answer" in checked) return checked.answer;
      } catch {
        /* a half-written line; the next poll sees it whole */
      }
    }
    return null;
  }
}

/**
 * Ask the band: publish the request on the bus (the dashboard reads it from
 * the transcript), wait for the approver, publish the decision.
 */
export async function askBand(
  bus: MessageBus,
  approver: Approver,
  from: string,
  req: Omit<ApprovalRequest, "mode">,
  text: string,
  signal?: AbortSignal
): Promise<ApprovalDecision> {
  const full: ApprovalRequest = { ...req, mode: approver.mode };
  bus.publish<ApprovalRequest>({ kind: "approval.request", from, to: "band", text, data: full });
  const decision = await approver.decide(full, signal);
  bus.publish<ApprovalDecision>({
    kind: "approval.decision",
    from: decision.by === "expired" ? from : decision.by,
    to: from,
    text: describeDecision(full, decision),
    data: decision,
  });
  return decision;
}
