import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CLASH_BONUS,
  calculateMatchupAwards,
  POINTS_PER_VOTE,
  type ScorableAnswer,
  settleMatchup,
  WINNER_BONUS,
} from "../../src/scoring.js";

const matchup = fc
  .tuple(fc.array(fc.tuple(fc.nat(8), fc.boolean()), { minLength: 1, maxLength: 2 }), fc.nat(10))
  .map(([rows, voters]) => ({
    answers: rows.map(
      ([votes, isPlaceholder], i): ScorableAnswer => ({
        id: `a${i}`,
        authorId: `P${i}`,
        votes,
        isPlaceholder,
      }),
    ),
    voters,
  }));

describe("scoring properties", () => {
  it("awards are non-negative, totals add up, and at most one winner", () => {
    fc.assert(
      fc.property(matchup, ({ answers, voters }) => {
        const awards = calculateMatchupAwards(answers, voters);
        expect(awards.filter((a) => a.isWinner).length).toBeLessThanOrEqual(1);
        for (const award of awards) {
          expect(award.votePoints).toBeGreaterThanOrEqual(0);
          expect(award.bonusPoints).toBeGreaterThanOrEqual(0);
          expect(award.total).toBe(award.votePoints + award.bonusPoints);
          expect(award.votePoints % POINTS_PER_VOTE).toBe(0);
          expect(award.bonusPoints).toBe(
            (award.isWinner ? WINNER_BONUS : 0) + (award.isClash ? CLASH_BONUS : 0),
          );
          if (award.isClash) expect(award.isWinner).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("awards nothing without eligible voters", () => {
    fc.assert(
      fc.property(matchup, ({ answers }) => {
        expect(calculateMatchupAwards(answers, 0)).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it("a forfeit pays each real author exactly the winner bonus", () => {
    fc.assert(
      fc.property(matchup, ({ answers, voters }) => {
        const awards = settleMatchup(answers, true, voters);
        expect(awards.map((a) => a.playerId)).toEqual(
          answers.filter((a) => !a.isPlaceholder).map((a) => a.authorId),
        );
        for (const award of awards) {
          expect(award.total).toBe(WINNER_BONUS);
          expect(award.isWinner).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("a played matchup settles as calculateMatchupAwards", () => {
    fc.assert(
      fc.property(matchup, ({ answers, voters }) => {
        expect(settleMatchup(answers, false, voters)).toEqual(
          calculateMatchupAwards(answers, voters),
        );
      }),
      { numRuns: 100 },
    );
  });
});
