import { EventEmitter } from "node:events";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Every message agents exchange, in one place. The dashboard's live feed is
 * literally this transcript, so messages carry a human-readable `text` next to
 * their structured payload.
 */
export type MessageKind =
  | "tour.request"
  | "venue.offer"
  | "venue.decline"
  | "band.plan"
  | "approval.request"
  | "approval.decision"
  | "show.proposed"
  | "show.accepted"
  | "show.rejected"
  | "fan.bought"
  | "crank.confirmed"
  | "crank.cancelled"
  | "crank.refunded"
  | "crank.settled"
  | "crew.offer"
  | "crew.hired"
  | "note";

export interface BusMessage<T = unknown> {
  id: number;
  at: number; // ms epoch
  kind: MessageKind;
  from: string; // agent id, e.g. "band:the-static-orchards" / "venue:berlin-lido" / "crank"
  to?: string; // omitted = broadcast
  text: string;
  data?: T;
  tx?: string; // signature when the message corresponds to an on-chain transaction
}

export class MessageBus {
  private emitter = new EventEmitter();
  private seq = 0;
  readonly log: BusMessage[] = [];
  private file?: string;

  constructor(opts: { file?: string } = {}) {
    this.emitter.setMaxListeners(10_000);
    if (opts.file) {
      this.file = opts.file;
      mkdirSync(dirname(opts.file), { recursive: true });
    }
  }

  publish<T>(m: Omit<BusMessage<T>, "id" | "at">): BusMessage<T> {
    const msg: BusMessage<T> = { id: ++this.seq, at: Date.now(), ...m };
    this.log.push(msg);
    if (this.file) appendFileSync(this.file, JSON.stringify(msg) + "\n");
    this.emitter.emit(msg.kind, msg);
    this.emitter.emit("*", msg);
    return msg;
  }

  on<T = unknown>(kind: MessageKind | "*", handler: (m: BusMessage<T>) => void): () => void {
    this.emitter.on(kind, handler);
    return () => this.emitter.off(kind, handler);
  }

  /** Collect messages of a kind addressed to `to` (or broadcast) for `ms` milliseconds. */
  collect<T>(kind: MessageKind, ms: number, to?: string): Promise<BusMessage<T>[]> {
    return new Promise((resolve) => {
      const got: BusMessage<T>[] = [];
      const off = this.on<T>(kind, (m) => {
        if (!to || !m.to || m.to === to) got.push(m);
      });
      setTimeout(() => {
        off();
        resolve(got);
      }, ms);
    });
  }
}
