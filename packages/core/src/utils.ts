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
  // Read through DataView so the result is a plain `number` (no undefined fallback branch).
  return new DataView(buffer.buffer).getUint32(0);
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

/**
 * A UUID-shaped identifier drawn from a seeded rng: 128 bits of PRNG output with the version and
 * variant nibbles set. The same seed yields the same ids, which is what makes identifiers that land
 * in synced state or action payloads replayable (`crypto.randomUUID()` would not).
 */
export function newId(rng: () => number): string {
  const hex = [0, 1, 2, 3]
    .map(() =>
      Math.floor(rng() * 0x100000000)
        .toString(16)
        .padStart(8, "0"),
    )
    .join("");
  const versioned = `${hex.slice(0, 12)}4${hex.slice(13)}`;
  const variant = ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  const id = `${versioned.slice(0, 16)}${variant}${versioned.slice(17)}`;
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}
