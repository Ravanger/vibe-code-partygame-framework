import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { mulberry32, shuffle } from "../src/index.js";

describe("shuffle properties", () => {
  it("is a permutation that leaves its input untouched", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), fc.integer(), (items, seed) => {
        const copy = [...items];
        const out = shuffle(items, mulberry32(seed));
        expect(items).toEqual(copy);
        expect([...out].sort((a, b) => a - b)).toEqual([...items].sort((a, b) => a - b));
      }),
      { numRuns: 200 },
    );
  });

  it("is deterministic per seed", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), fc.integer(), (items, seed) => {
        expect(shuffle(items, mulberry32(seed))).toEqual(shuffle(items, mulberry32(seed)));
      }),
      { numRuns: 200 },
    );
  });
});

describe("mulberry32 properties", () => {
  it("yields floats in [0, 1) and the same sequence per seed", () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const a = mulberry32(seed);
        const b = mulberry32(seed);
        for (let i = 0; i < 20; ++i) {
          const x = a();
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(1);
          expect(b()).toBe(x);
        }
      }),
      { numRuns: 200 },
    );
  });
});
