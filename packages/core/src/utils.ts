/** Narrows a lookup the caller knows succeeds; throws a named error when that assumption breaks. */
export function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Missing ${what}`);
  return value;
}

/**
 * mulberry32: a small, fast, seedable PRNG returning floats in [0, 1). The same seed produces the
 * same sequence on every platform — what makes action logs replayable.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random 32-bit seed for a seeded PRNG, drawn from the platform CSPRNG. */
export function randomSeed(): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] ?? 0;
}

/** Fisher-Yates over a copy; pass a seeded `rng` in tests. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; --i) {
    const j = Math.floor(rng() * (i + 1));
    const atI = required(a[i], "shuffle index");
    a[i] = required(a[j], "shuffle index");
    a[j] = atI;
  }
  return a;
}
