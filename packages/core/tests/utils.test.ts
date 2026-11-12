import { describe, expect, it } from "vitest";
import { mulberry32, newId, randomSeed, required, shuffle, weightedSample } from "../src/index.js";

describe("required", () => {
  it("returns a defined value, including falsy ones", () => {
    expect(required(0, "zero")).toBe(0);
    expect(required("", "empty")).toBe("");
  });

  it("throws naming what was missing", () => {
    expect(() => required(undefined, "answer author")).toThrow("Missing answer author");
  });
});

describe("shuffle", () => {
  it("returns a permutation and leaves the input alone", () => {
    const items = [1, 2, 3, 4];
    const out = shuffle(items, () => 0);
    expect([...out].sort()).toEqual([1, 2, 3, 4]);
    expect(out).not.toEqual(items);
    expect(items).toEqual([1, 2, 3, 4]);
  });

  it("keeps the order when the rng always picks the current slot", () => {
    expect(shuffle([1, 2, 3], () => 0.999)).toEqual([1, 2, 3]);
  });
});

describe("weightedSample", () => {
  it("never picks an item whose weight is 0", () => {
    const items = [
      { id: "a", w: 1 },
      { id: "b", w: 0 },
      { id: "c", w: 2 },
    ];
    for (let i = 0; i < 40; ++i) {
      expect(
        weightedSample(items, 3, mulberry32(i), (item) => item.w).map((item) => item.id),
      ).not.toContain("b");
    }
  });

  it("matches a uniform shuffle for the same seed when all weights are equal", () => {
    const items = [1, 2, 3, 4, 5];
    expect(weightedSample(items, 3, mulberry32(7), () => 1)).toEqual(
      shuffle(items, mulberry32(7)).slice(0, 3),
    );
  });

  it("picks a much heavier item far more often", () => {
    const items = [
      { id: "light", w: 1 },
      { id: "heavy", w: 50 },
    ];
    let heavy = 0;
    for (let i = 0; i < 200; ++i) {
      const picked = weightedSample(items, 1, mulberry32(i), (item) => item.w);
      if (picked[0]?.id === "heavy") ++heavy;
    }
    expect(heavy).toBeGreaterThan(150);
  });

  it("returns the whole pool when asked for more than exist", () => {
    const items = [
      { id: "a", w: 1 },
      { id: "b", w: 2 },
    ];
    expect(
      weightedSample(items, 5, mulberry32(3), (item) => item.w)
        .map((item) => item.id)
        .sort(),
    ).toEqual(["a", "b"]);
  });

  it("requires an rng: no default Math.random", () => {
    expect(weightedSample.length).toBe(4);
  });
});

describe("mulberry32", () => {
  it("returns floats in [0, 1)", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 1000; ++i) {
      const value = rng();
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("produces the same sequence for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
    expect(new Set(seqA).size).toBeGreaterThan(1); // not a constant stream
  });

  it("produces different sequences for different seeds", () => {
    const a = Array.from({ length: 20 }, () => mulberry32(1)());
    const b = Array.from({ length: 20 }, () => mulberry32(2)());
    expect(a).not.toEqual(b);
  });
});

describe("sfc32", async () => {
  const mod = await import("../src/utils.js");
  const sfc32 = mod.sfc32;

  it("returns floats in [0, 1)", () => {
    const rng = sfc32([1, 2, 3, 4]);
    for (let i = 0; i < 1000; ++i) {
      const value = rng();
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("produces the same sequence for the same seed", () => {
    const a = sfc32([42, 43, 44, 45]);
    const b = sfc32([42, 43, 44, 45]);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
    expect(new Set(seqA).size).toBeGreaterThan(1);
  });

  it("produces different sequences for different seeds", () => {
    const a = Array.from({ length: 20 }, () => sfc32([1, 2, 3, 4])());
    const b = Array.from({ length: 20 }, () => sfc32([5, 6, 7, 8])());
    expect(a).not.toEqual(b);
  });

  it("differs when only the first word differs", () => {
    const a = sfc32([1, 0, 0, 0]);
    const b = sfc32([2, 0, 0, 0]);
    expect(a()).not.toBe(b());
  });
});

describe("seedFromNumber", async () => {
  const mod = await import("../src/utils.js");
  const seedFromNumber = mod.seedFromNumber;

  it("is deterministic for the same number", () => {
    expect(seedFromNumber(42)).toEqual(seedFromNumber(42));
  });

  it("differs for different numbers", () => {
    expect(seedFromNumber(1)).not.toEqual(seedFromNumber(2));
  });

  it("returns a 4-tuple of unsigned 32-bit integers", () => {
    const seed = seedFromNumber(100);
    expect(Array.isArray(seed)).toBe(true);
    expect(seed.length).toBe(4);
    for (const word of seed) {
      expect(Number.isInteger(word)).toBe(true);
      expect(word).toBeGreaterThanOrEqual(0);
      expect(word).toBeLessThanOrEqual(2 ** 32 - 1);
    }
  });
});

describe("randomSeed", () => {
  it("returns a 4-tuple of unsigned 32-bit integers", () => {
    for (let i = 0; i < 100; ++i) {
      const seed = randomSeed();
      expect(Array.isArray(seed)).toBe(true);
      expect(seed.length).toBe(4);
      for (const word of seed) {
        expect(Number.isInteger(word)).toBe(true);
        expect(word).toBeGreaterThanOrEqual(0);
        expect(word).toBeLessThanOrEqual(2 ** 32 - 1);
      }
    }
  });

  it("returns different values on successive calls", () => {
    const a = randomSeed();
    const b = randomSeed();
    expect(a).not.toEqual(b);
  });
});

describe("newId", () => {
  it("returns a v4-shaped uuid", () => {
    for (let i = 0; i < 100; ++i) {
      expect(newId(mulberry32(i))).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  it("is deterministic for a seed and keeps the shared stream aligned", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect(newId(a)).toBe(newId(b));
    expect(a()).toBe(b()); // the streams stay in step after an id
  });

  it("differs across seeds", () => {
    expect(newId(mulberry32(1))).not.toBe(newId(mulberry32(2)));
  });

  it("is unique within a long session", () => {
    const rng = mulberry32(1234);
    const ids = new Set(Array.from({ length: 10_000 }, () => newId(rng)));
    expect(ids.size).toBe(10_000);
  });
});
