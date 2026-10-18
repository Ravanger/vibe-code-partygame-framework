import { describe, expect, it } from "vitest";
import { FOOL_POINTS, GUESS_POINTS, settleRound } from "../../src/scoring.js";

const T = "truth";
const F1 = "fake-1";
const F2 = "fake-2";

describe("settleRound", () => {
  it("awards nothing without votes", () => {
    expect(settleRound(new Map(), T, new Map([[F1, "p1"]]))).toEqual([]);
  });

  it("awards the truth guesser only", () => {
    expect(settleRound(new Map([["p1", T]]), T, new Map())).toEqual([
      { playerId: "p1", points: GUESS_POINTS, fooledCount: 0, guessedTruth: true },
    ]);
  });

  it("awards a fake's author per vote and not the wrong voter", () => {
    expect(settleRound(new Map([["p1", F2]]), T, new Map([[F2, "p2"]]))).toEqual([
      { playerId: "p2", points: FOOL_POINTS, fooledCount: 1, guessedTruth: false },
    ]);
  });

  it("combines guessing and fooling into one entry", () => {
    const votes = new Map([
      ["p1", T],
      ["p2", F1],
      ["p3", F1],
    ]);
    expect(settleRound(votes, T, new Map([[F1, "p1"]]))).toEqual([
      {
        playerId: "p1",
        points: GUESS_POINTS + 2 * FOOL_POINTS,
        fooledCount: 2,
        guessedTruth: true,
      },
    ]);
  });

  it("lists entries in first-encounter order", () => {
    const votes = new Map([
      ["p1", F2],
      ["p2", T],
    ]);
    const awards = settleRound(votes, T, new Map([[F2, "p3"]]));
    expect(awards.map((a) => a.playerId)).toEqual(["p3", "p2"]);
  });

  it("ignores votes for options with no known author other than the truth", () => {
    expect(settleRound(new Map([["p1", "orphan"]]), T, new Map())).toEqual([]);
  });
});
