import { describe, expect, it } from "vitest";
import { awardPoints, leaderboard } from "../src/scoring.js";

describe("awardPoints", () => {
  it("accumulates", () => {
    const s: Record<string, number> = {};
    awardPoints(s, "p1", 100);
    awardPoints(s, "p1", 50);
    expect(s.p1).toBe(150);
  });
  it("starts a new player from zero", () => {
    const s: Record<string, number> = {};
    awardPoints(s, "p9", 10);
    expect(s.p9).toBe(10);
  });
});

describe("leaderboard", () => {
  it("sorts high to low", () => {
    const sorted = leaderboard({ p1: 100, p2: 300, p3: 200 });
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from sorted result
    expect(sorted[0]!.playerId).toBe("p2");
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from sorted result
    expect(sorted[1]!.playerId).toBe("p3");
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from sorted result
    expect(sorted[2]!.playerId).toBe("p1");
  });
  it("breaks equal scores deterministically", () => {
    expect(leaderboard({ b: 100, a: 100 })).toEqual(leaderboard({ a: 100, b: 100 }));
  });
  it("handles an empty map", () => {
    expect(leaderboard({})).toEqual([]);
  });
});
