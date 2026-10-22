/** A 128-bit PRNG seed: four unsigned 32-bit integers. */
export type Seed = readonly [number, number, number, number];

/** Narrows a lookup the caller knows succeeds; throws a named error when that assumption breaks. */
export function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Missing ${what}`);
  return value;
}

/**
 * sfc32: a seedable PRNG with 128 bits of state, returning floats in [0, 1). The same seed produces the
 * same sequence on every platform, which is what makes action logs replayable.
 */
export function sfc32(seed: Seed): () => number {
  let [a, b, c, d] = seed;
  const next = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; ++i) next();
  return next;
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

/** A random 128-bit seed for {@link sfc32}, drawn from the platform CSPRNG. */
export function randomSeed(): Seed {
  const view = new DataView(globalThis.crypto.getRandomValues(new Uint32Array(4)).buffer);
  const word = (i: number): number => view.getUint32(i * 4, true);
  return [word(0), word(1), word(2), word(3)];
}

/** A deterministic 128-bit seed expanded from a number, for tests. */
export function seedFromNumber(n: number): Seed {
  const rng = mulberry32(n);
  const word = (): number => Math.floor(rng() * 0x100000000);
  return [word(), word(), word(), word()];
}

/** Recursively freezes an object graph (in place) and returns it; non-objects pass through unchanged. */
export function deepFreeze(value: unknown): unknown {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
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
