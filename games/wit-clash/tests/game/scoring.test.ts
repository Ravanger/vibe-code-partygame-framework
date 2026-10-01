import { describe, expect, it } from "vitest";
import { calculateMatchupAwards } from "../../src/scoring.js";
import { nth } from "./support.js";

const ans = (id: string, authorId: string, votes: number, isPlaceholder = false) => ({
  id,
  authorId,
  votes,
  isPlaceholder,
});

describe("calculateMatchupAwards", () => {
  it("awards 100 per vote", () => {
    const awards = calculateMatchupAwards([ans("a", "P1", 3), ans("b", "P2", 1)], 4);
    const a = nth(awards, 0);
    const b = nth(awards, 1);
    expect(a.votePoints).toBe(300);
    expect(b.votePoints).toBe(100);
  });

  it("adds the winner bonus to the higher answer only", () => {
    const awards = calculateMatchupAwards([ans("a", "P1", 3), ans("b", "P2", 1)], 4);
    const a = nth(awards, 0);
    const b = nth(awards, 1);
    expect(a.total).toBe(350);
    expect(b.total).toBe(100);
    expect(a.isWinner).toBe(true);
    expect(b.isWinner).toBe(false);
  });

  it("gives no winner bonus on a tie", () => {
    const awards = calculateMatchupAwards([ans("a", "P1", 2), ans("b", "P2", 2)], 4);
    const a = nth(awards, 0);
    const b = nth(awards, 1);
    expect(a.total).toBe(200);
    expect(b.total).toBe(200);
  });

  it("awards CLASH for a clean sweep", () => {
    const awards = calculateMatchupAwards([ans("a", "P1", 4), ans("b", "P2", 0)], 4);
    const a = nth(awards, 0);
    const b = nth(awards, 1);
    expect(a.isClash).toBe(true);
    expect(a.total).toBe(600);
    expect(b.isClash).toBe(false);
  });

  it("does NOT award CLASH with a single eligible voter", () => {
    const awards = calculateMatchupAwards([ans("a", "P1", 1), ans("b", "P2", 0)], 1);
    const a = nth(awards, 0);
    expect(a.isClash).toBe(false);
    expect(a.total).toBe(150);
  });

  it("does NOT award CLASH when someone abstained", () => {
    const awards = calculateMatchupAwards([ans("a", "P1", 3), ans("b", "P2", 0)], 4);
    const a = nth(awards, 0);
    expect(a.isClash).toBe(false);
    expect(a.total).toBe(350);
  });

  it("returns nothing when no one was eligible to vote", () => {
    expect(calculateMatchupAwards([ans("a", "P1", 0), ans("b", "P2", 0)], 0)).toEqual([]);
  });

  it("gives zero and no bonus to a placeholder answer", () => {
    const awards = calculateMatchupAwards([ans("a", "P1", 0, true), ans("b", "P2", 2)], 3);
    const a = nth(awards, 0);
    const b = nth(awards, 1);
    expect(a.total).toBe(0);
    expect(a.isWinner).toBe(false);
    expect(b.isWinner).toBe(true);
    expect(b.total).toBe(250);
  });

  it("handles a matchup where nobody voted", () => {
    const awards = calculateMatchupAwards([ans("a", "P1", 0), ans("b", "P2", 0)], 3);
    expect(awards).toHaveLength(2);
    expect(awards.every((x) => x.total === 0 && !x.isWinner)).toBe(true);
  });

  it("handles a single-answer matchup with CLASH", () => {
    const awards = calculateMatchupAwards([ans("a", "P1", 2)], 2);
    const a = nth(awards, 0);
    expect(a.isWinner).toBe(true);
    expect(a.isClash).toBe(true);
    expect(a.total).toBe(400);
  });

  it("ignores answers with no author", () => {
    expect(calculateMatchupAwards([ans("a", "", 0)], 2)).toEqual([]);
  });
});
