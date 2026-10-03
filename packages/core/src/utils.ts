/** Narrows a lookup the caller knows succeeds; throws a named error when that assumption breaks. */
export function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Missing ${what}`);
  return value;
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
