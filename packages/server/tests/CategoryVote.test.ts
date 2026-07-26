import { describe, expect, it } from "vitest";
import { resolveCategoryVote } from "../src/rooms/resolveCategoryVote.js";

const opts = [
  { id: "a", name: "A", emoji: "🅰️", votes: 0 },
  { id: "b", name: "B", emoji: "🅱️", votes: 0 },
  { id: "c", name: "C", emoji: "🇨", votes: 0 },
];

describe("resolveCategoryVote", () => {
  it("returns the clear plurality winner", () => {
    const o = [{ ...opts[0]!, votes: 3 }, { ...opts[1]!, votes: 1 }, opts[2]!];
    expect(resolveCategoryVote(o, () => 0)).toBe("a");
  });

  it("breaks a tie only among the joint leaders", () => {
    const o = [
      { ...opts[0]!, votes: 2 },
      { ...opts[1]!, votes: 2 },
      { ...opts[2]!, votes: 1 },
    ];
    expect(["a", "b"]).toContain(resolveCategoryVote(o, () => 0.99));
    expect(resolveCategoryVote(o, () => 0)).toBe("a");
  });

  it("picks at random when nobody voted", () => {
    expect(["a", "b", "c"]).toContain(resolveCategoryVote(opts, () => 0.5));
  });

  it("handles a single option", () => {
    expect(resolveCategoryVote([opts[0]!], () => 0)).toBe("a");
  });

  it("throws on an empty option list", () => {
    expect(() => resolveCategoryVote([], () => 0)).toThrow();
  });
});
