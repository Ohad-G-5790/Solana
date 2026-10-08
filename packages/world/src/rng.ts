import { createHash } from "node:crypto";

/**
 * Small deterministic PRNG (mulberry32) so the whole world is reproducible
 * from one string seed. Not for cryptography; wallet seeds are derived with
 * SHA-256 from the rng stream plus a label.
 */
export class Rng {
  private state: number;

  constructor(seed: string | number) {
    const h = createHash("sha256").update(String(seed)).digest();
    this.state = h.readUInt32LE(0) >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Pick n distinct items. */
  sample<T>(arr: readonly T[], n: number): T[] {
    const copy = [...arr];
    const out: T[] = [];
    while (out.length < n && copy.length > 0) {
      const i = Math.floor(this.next() * copy.length);
      out.push(copy.splice(i, 1)[0]);
    }
    return out;
  }

  /** Normal-ish value via sum of uniforms, clamped. */
  gauss(mean: number, sd: number, min = -Infinity, max = Infinity): number {
    let s = 0;
    for (let i = 0; i < 6; i++) s += this.next();
    const v = mean + ((s - 3) / 3) * sd * 1.7;
    return Math.min(max, Math.max(min, v));
  }

  /** 32-byte hex seed derived from the stream and a label (for wallet derivation). */
  seedHex(label: string): string {
    const a = Math.floor(this.next() * 2 ** 32);
    const b = Math.floor(this.next() * 2 ** 32);
    return createHash("sha256").update(`${label}:${a}:${b}`).digest("hex");
  }
}
