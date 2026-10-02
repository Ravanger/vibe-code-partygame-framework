import { describe, expect, it } from "vitest";
import { required, shuffle } from "../src/index.js";

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
