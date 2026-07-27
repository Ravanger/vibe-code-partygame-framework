import { describe, expect, it } from "vitest";
import { awardPoints, calculateMatchupAwards, leaderboard } from "../src/scoring.js";

const ans = (id: string, authorId: string, votes: number, isPlaceholder = false) => ({
  id,
  authorId,
  votes,
  isPlaceholder,
});

describe("calculateMatchupAwards", () => {
  it("awards 100 per vote", () => {
    const [a, b] = calculateMatchupAwards([ans("a", "P1", 3), ans("b", "P2", 1)], 4);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(a!.votePoints).toBe(300);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(b!.votePoints).toBe(100);
  });

  it("adds the winner bonus to the higher answer only", () => {
    const [a, b] = calculateMatchupAwards([ans("a", "P1", 3), ans("b", "P2", 1)], 4);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(a!.total).toBe(350);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(b!.total).toBe(100);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(a!.isWinner).toBe(true);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(b!.isWinner).toBe(false);
  });

  it("gives no winner bonus on a tie", () => {
    const [a, b] = calculateMatchupAwards([ans("a", "P1", 2), ans("b", "P2", 2)], 4);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(a!.total).toBe(200);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(b!.total).toBe(200);
  });

  it("awards CLASH for a clean sweep", () => {
    const [a, b] = calculateMatchupAwards([ans("a", "P1", 4), ans("b", "P2", 0)], 4);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(a!.isClash).toBe(true);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(a!.total).toBe(600);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(b!.isClash).toBe(false);
  });

  it("does NOT award CLASH with a single eligible voter", () => {
    const [a] = calculateMatchupAwards([ans("a", "P1", 1), ans("b", "P2", 0)], 1);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(a!.isClash).toBe(false);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(a!.total).toBe(150);
  });

  it("does NOT award CLASH when someone abstained", () => {
    const [a] = calculateMatchupAwards([ans("a", "P1", 3), ans("b", "P2", 0)], 4);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(a!.isClash).toBe(false);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(a!.total).toBe(350);
  });

  it("returns nothing when no one was eligible to vote", () => {
    expect(calculateMatchupAwards([ans("a", "P1", 0), ans("b", "P2", 0)], 0)).toEqual([]);
  });

  it("gives zero and no bonus to a placeholder answer", () => {
    const [a, b] = calculateMatchupAwards([ans("a", "P1", 0, true), ans("b", "P2", 2)], 3);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(a!.total).toBe(0);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(a!.isWinner).toBe(false);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(b!.isWinner).toBe(true);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(b!.total).toBe(250);
  });

  it("handles a matchup where nobody voted", () => {
    const awards = calculateMatchupAwards([ans("a", "P1", 0), ans("b", "P2", 0)], 3);
    expect(awards).toHaveLength(2);
    expect(awards.every((x) => x.total === 0 && !x.isWinner)).toBe(true);
  });

  it("handles a single-answer matchup with CLASH", () => {
    const [a] = calculateMatchupAwards([ans("a", "P1", 2)], 2);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(a!.isWinner).toBe(true);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(a!.isClash).toBe(true);
    // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist from destructure
    expect(a!.total).toBe(400);
  });

  it("ignores answers with no author", () => {
    expect(calculateMatchupAwards([ans("a", "", 0)], 2)).toEqual([]);
  });
});

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
