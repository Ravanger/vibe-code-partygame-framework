import { describe, expect, it } from "vitest";
import { mulberry32, newId, randomSeed, required, shuffle } from "../src/index.js";

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

describe("randomSeed", () => {
  it("returns an unsigned 32-bit integer", () => {
    for (let i = 0; i < 100; ++i) {
      const seed = randomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(2 ** 32 - 1);
    }
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
