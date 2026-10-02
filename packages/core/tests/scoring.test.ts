import { describe, expect, it } from "vitest";
import { awardPoints, composeLeaderboard, leaderboard } from "../src/scoring.js";

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

describe("composeLeaderboard", () => {
  it("lists seated players first and leavers below, each group best first", () => {
    const rows = composeLeaderboard({
      scores: { a: 10, b: 50, c: 30, d: 30 },
      seatedNames: new Map([
        ["a", "Ann"],
        ["c", "Cy"],
      ]),
      rememberedNames: { b: "Bo", d: "Di" },
    });
    expect(rows).toEqual([
      { playerId: "c", name: "Cy", score: 30, hasLeft: false },
      { playerId: "a", name: "Ann", score: 10, hasLeft: false },
      { playerId: "b", name: "Bo", score: 50, hasLeft: true },
      { playerId: "d", name: "Di", score: 30, hasLeft: true },
    ]);
  });
  it("lists players in ids without a score at zero and falls back to an empty name", () => {
    const rows = composeLeaderboard({
      scores: {},
      seatedNames: new Map([["a", "Ann"]]),
      rememberedNames: {},
      ids: ["a", "z"],
    });
    expect(rows).toEqual([
      { playerId: "a", name: "Ann", score: 0, hasLeft: false },
      { playerId: "z", name: "", score: 0, hasLeft: true },
    ]);
  });
  it("prefers the seated name over the remembered one", () => {
    const [row] = composeLeaderboard({
      scores: { a: 1 },
      seatedNames: new Map([["a", "New"]]),
      rememberedNames: { a: "Old" },
    });
    expect(row?.name).toBe("New");
  });
});
