import { describe, expect, it } from "vitest";
import { between } from "../src/index.js";

describe("between", () => {
  it("accepts integers inside the bounds only", () => {
    expect(between(3, 1, 3)).toBe(true);
    expect(between(0, 1, 3)).toBe(false);
    expect(between(4, 1, 3)).toBe(false);
    expect(between(1.5, 1, 3)).toBe(false);
    expect(between(Number.NaN, 1, 3)).toBe(false);
  });
});
