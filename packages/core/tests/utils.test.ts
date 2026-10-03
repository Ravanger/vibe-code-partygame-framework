import { describe, expect, it } from "vitest";
import { mulberry32, randomSeed, required, shuffle } from "../src/index.js";

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
