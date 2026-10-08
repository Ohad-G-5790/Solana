/**
 * The "brain" is where an agent thinks. Every decision has a deterministic
 * heuristic implementation (always available, used by tests and the QA bot)
 * and may be refined by Claude when ANTHROPIC_API_KEY is set. Claude never
 * gets to sign anything: it returns a structured choice that is validated
 * against the heuristic's constraints before any transaction is built.
 */
export interface Decision<T> {
  /** Short natural-language reasoning shown in the live feed. */
  reasoning: string;
  value: T;
  source: "heuristic" | "claude";
}

export interface DecisionTask<T> {
  agent: string;
  /** What the agent is deciding, in one line (used in logs). */
  title: string;
  /** Persona + rules for the model. */
  system: string;
  /** The situation, as text the model can read. */
  prompt: string;
  /** JSON schema (loose) the model must follow; also used in the prompt. */
  schema: Record<string, unknown>;
  /** Heuristic answer; the model sees it as the baseline it may adjust. */
  heuristic: () => { value: T; reasoning: string };
  /** Reject model answers that break hard constraints. Return a reason or null. */
  validate?: (value: T) => string | null;
}

export interface Brain {
  readonly name: string;
  decide<T>(task: DecisionTask<T>): Promise<Decision<T>>;
}

export class HeuristicBrain implements Brain {
  readonly name = "heuristic";
  async decide<T>(task: DecisionTask<T>): Promise<Decision<T>> {
    const { value, reasoning } = task.heuristic();
    return { value, reasoning, source: "heuristic" };
  }
}

/** The slice of the Anthropic client the brain uses (lets tests inject a fake). */
export interface MessagesClient {
  messages: { create(params: Record<string, unknown>): Promise<{ content: { type: string; text?: string }[] }> };
}

export interface ClaudeBrainOptions {
  apiKey?: string;
  model?: string;
  /** Pre-built client (tests); otherwise @anthropic-ai/sdk is loaded lazily. */
  client?: MessagesClient;
  /** Max parallel requests; subscription-free API keys have per-minute limits. */
  concurrency?: number;
  /** Per-call timeout in ms; on timeout the heuristic answer is used. */
  timeoutMs?: number;
}

/**
 * Claude-backed brain using the Anthropic Messages API. Falls back to the
 * heuristic on any error so a demo never stalls on the network.
 */
export class ClaudeBrain implements Brain {
  readonly name = "claude";
  private client: MessagesClient | null = null;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly apiKey: string;
  private inFlight = 0;
  private readonly concurrency: number;
  private readonly queue: (() => void)[] = [];
  stats = { calls: 0, used: 0, fallbacks: 0 };

  constructor(opts: ClaudeBrainOptions = {}) {
    const key = opts.apiKey ?? process.env.ANTHROPIC_API_KEY ?? (opts.client ? "injected" : undefined);
    if (!key) throw new Error("ClaudeBrain needs ANTHROPIC_API_KEY");
    this.apiKey = key;
    this.client = opts.client ?? null;
    this.model = opts.model ?? process.env.GREENROOM_MODEL ?? "claude-haiku-5-5";
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.concurrency = opts.concurrency ?? 3;
  }

  private async slot<R>(fn: () => Promise<R>): Promise<R> {
    if (this.inFlight >= this.concurrency) await new Promise<void>((r) => this.queue.push(r));
    this.inFlight++;
    try {
      return await fn();
    } finally {
      this.inFlight--;
      this.queue.shift()?.();
    }
  }

  async decide<T>(task: DecisionTask<T>): Promise<Decision<T>> {
    const base = task.heuristic();
    this.stats.calls++;
    try {
      const out = await this.slot(() => this.ask<T>(task, base));
      const problem = task.validate?.(out.value);
      if (problem) throw new Error(`model answer rejected: ${problem}`);
      this.stats.used++;
      return { value: out.value, reasoning: out.reasoning, source: "claude" };
    } catch (e) {
      this.stats.fallbacks++;
      return { value: base.value, reasoning: `${base.reasoning} (heuristic; Claude unavailable: ${(e as Error).message.slice(0, 80)})`, source: "heuristic" };
    }
  }

  private async ask<T>(task: DecisionTask<T>, base: { value: T; reasoning: string }): Promise<{ value: T; reasoning: string }> {
    if (!this.client) {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      this.client = new Anthropic({ apiKey: this.apiKey, timeout: this.timeoutMs, maxRetries: 1 }) as unknown as MessagesClient;
    }
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 600,
      system: `${task.system}\nYou answer with a single JSON object and nothing else. Shape: ${JSON.stringify(task.schema)}. Include a "reasoning" string of at most 2 sentences.`,
      messages: [
        {
          role: "user",
          content: `${task.prompt}\n\nBaseline proposal from the deterministic planner (you may keep it or adjust it within the rules): ${JSON.stringify(
            base.value
          )}\nBaseline reasoning: ${base.reasoning}`,
        },
      ],
    });
    const text = res.content
      .map((c) => (c.type === "text" ? (c.text ?? "") : ""))
      .join("")
      .trim();
    const json = text.startsWith("{") ? text : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as { reasoning?: string } & Record<string, unknown>;
    const { reasoning, ...rest } = parsed;
    const value = ("value" in rest ? rest.value : rest) as T;
    return { value, reasoning: reasoning ?? "Claude decided." };
  }
}

export function makeBrain(kind?: string): Brain {
  const want = kind ?? process.env.GREENROOM_BRAIN ?? (process.env.ANTHROPIC_API_KEY ? "claude" : "heuristic");
  if (want === "claude") {
    try {
      return new ClaudeBrain();
    } catch {
      return new HeuristicBrain();
    }
  }
  return new HeuristicBrain();
}
