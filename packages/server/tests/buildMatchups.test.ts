import { describe, expect, it } from "vitest";
import { buildMatchups } from "../src/rooms/buildMatchups.js";

const players = (n: number) => Array.from({ length: n }, (_, i) => `P${i + 1}`);
const prompts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `q${i}`, text: `Q${i}` }));
const noShuffle = () => 0;

describe("buildMatchups ring pairing", () => {
  it("creates one matchup per player", () => {
    expect(buildMatchups(players(6), prompts(6), noShuffle)).toHaveLength(6);
  });

  it("gives every matchup exactly two authors", () => {
    for (const m of buildMatchups(players(6), prompts(6), noShuffle)) {
      expect(m.authorIds).toHaveLength(2);
    }
  });

  it("gives every player exactly two prompts", () => {
    const ms = buildMatchups(players(6), prompts(6), noShuffle);
    for (const p of players(6)) {
      expect(ms.filter((m) => m.authorIds.includes(p))).toHaveLength(2);
    }
  });

  it("never pairs a player with themselves", () => {
    for (const m of buildMatchups(players(6), prompts(6), noShuffle)) {
      expect(m.authorIds[0]).not.toBe(m.authorIds[1]);
    }
  });

  it("uses a distinct prompt for each matchup", () => {
    const ms = buildMatchups(players(6), prompts(6), noShuffle);
    expect(new Set(ms.map((m) => m.promptText)).size).toBe(6);
  });

  it("holds all four invariants for every size from 3 to 8", () => {
    for (const n of [3, 4, 5, 6, 7, 8]) {
      const ms = buildMatchups(players(n), prompts(n), noShuffle);
      expect(ms).toHaveLength(n);
      for (const p of players(n)) expect(ms.filter((m) => m.authorIds.includes(p))).toHaveLength(2);
      for (const m of ms) expect(new Set(m.authorIds).size).toBe(2);
    }
  });

  it("varies the pairing between rounds given a different rng", () => {
    const a = buildMatchups(players(6), prompts(6), () => 0);
    const b = buildMatchups(players(6), prompts(6), () => 0.99);
    expect(a.map((m) => m.authorIds.join())).not.toEqual(b.map((m) => m.authorIds.join()));
  });

  it("reuses prompts with wraparound when the category is short", () => {
    const ms = buildMatchups(players(6), prompts(2), noShuffle);
    expect(ms).toHaveLength(6);
    expect(ms.every((m) => m.promptText !== "")).toBe(true);
  });
});

describe("degenerate sizes", () => {
  it("makes one single-author matchup for one player", () => {
    const ms = buildMatchups(players(1), prompts(4), noShuffle);
    expect(ms).toHaveLength(1);
    expect(ms[0]!.authorIds).toEqual(["P1"]);
  });

  it("makes one two-author matchup for two players", () => {
    const ms = buildMatchups(players(2), prompts(4), noShuffle);
    expect(ms).toHaveLength(1);
    expect(ms[0]!.authorIds).toEqual(expect.arrayContaining(["P1", "P2"]));
  });

  it("returns nothing for zero players", () => {
    expect(buildMatchups([], prompts(4), noShuffle)).toEqual([]);
  });
});
