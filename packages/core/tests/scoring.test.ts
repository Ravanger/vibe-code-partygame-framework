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
    expect(sorted.map((e) => e.playerId)).toEqual(["p2", "p3", "p1"]);
  });
  it("breaks equal scores deterministically", () => {
    expect(leaderboard({ b: 100, a: 100 })).toEqual(leaderboard({ a: 100, b: 100 }));
  });
  it("breaks ties by code-point order, not locale", () => {
    const sorted = leaderboard({ aaaaaaaa: 100, Baaaaaaa: 100 });
    expect(sorted.map((e) => e.playerId)).toEqual(["Baaaaaaa", "aaaaaaaa"]);
  });
  it("handles three-way ties in code-point order", () => {
    const sorted = leaderboard({ ccc: 50, aaa: 50, bbb: 50 });
    expect(sorted.map((e) => e.playerId)).toEqual(["aaa", "bbb", "ccc"]);
  });
  it("handles an empty map", () => {
    expect(leaderboard({})).toEqual([]);
  });
});

describe("reserved ids", () => {
  it("are scored as own keys without touching the prototype", () => {
    const s: Record<string, number> = {};
    for (const id of ["__proto__", "constructor", "toString"]) {
      awardPoints(s, id, 2);
      awardPoints(s, id, 3);
    }
    expect(Object.getPrototypeOf(s)).toBe(Object.prototype);
    expect(leaderboard(s)).toEqual([
      { playerId: "__proto__", score: 5 },
      { playerId: "constructor", score: 5 },
      { playerId: "toString", score: 5 },
    ]);
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
  it("handles reserved ids and ignores inherited names", () => {
    const scores: Record<string, number> = {};
    awardPoints(scores, "__proto__", 1);
    const rows = composeLeaderboard({
      scores,
      seatedNames: new Map(),
      rememberedNames: {},
      ids: ["constructor"],
    });
    expect(rows).toEqual([
      { playerId: "__proto__", name: "", score: 1, hasLeft: true },
      { playerId: "constructor", name: "", score: 0, hasLeft: true },
    ]);
  });
});
