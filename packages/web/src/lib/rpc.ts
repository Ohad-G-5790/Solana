import { RPC_URL } from "./config";

/**
 * Polite fetch for public RPCs. The public devnet endpoint answers bursts
 * with HTTP 429 ("Connection rate limits exceeded"), so requests go out at
 * most two at a time with a short gap, and a 429 waits (1 s, 2 s, 4 s) before
 * trying again. A local validator gets no throttling.
 */
const LOCAL = /127\.0\.0\.1|localhost/.test(RPC_URL);
const MAX_IN_FLIGHT = LOCAL ? 16 : 2;
const GAP_MS = LOCAL ? 0 : 120;

let inFlight = 0;
let lastStart = 0;
const waiting: (() => void)[] = [];
/** ms epoch until which the RPC said "too many requests" (for the UI). */
let limitedUntil = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function acquire(): Promise<void> {
  if (inFlight >= MAX_IN_FLIGHT) await new Promise<void>((r) => waiting.push(r));
  inFlight++;
  const wait = lastStart + GAP_MS - Date.now();
  lastStart = Math.max(Date.now(), lastStart + GAP_MS);
  if (wait > 0) await sleep(wait);
}

function release(): void {
  inFlight--;
  waiting.shift()?.();
}

export const politeFetch: typeof fetch = async (input, init) => {
  for (let attempt = 0; ; attempt++) {
    await acquire();
    let res: Response;
    try {
      res = await fetch(input, init);
    } finally {
      release();
    }
    if (res.status !== 429 || attempt >= 3) return res;
    const backoff = 1000 * 2 ** attempt;
    limitedUntil = Date.now() + backoff;
    await sleep(backoff);
  }
};

export function rateLimitedRecently(): boolean {
  return Date.now() < limitedUntil + 15_000;
}

export function isRateLimit(e: unknown): boolean {
  return /429|rate limit/i.test(String((e as Error)?.message ?? e));
}
