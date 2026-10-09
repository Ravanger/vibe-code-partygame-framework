import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { awardPoints, composeLeaderboard, leaderboard } from "../src/index.js";

const ids = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), { maxLength: 12 });
const scoreMap = fc
  .tuple(ids, fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 12, maxLength: 12 }))
  .map(([keys, values]) =>
    Object.fromEntries(keys.map((key, index) => [key, values[index] ?? 0] as const)),
  );

describe("leaderboard properties", () => {
  it("is sorted, a permutation of its input, and deterministic on ties", () => {
    fc.assert(
      fc.property(scoreMap, (scores) => {
        const board = leaderboard(scores);
        expect(board.map((e) => e.playerId).sort()).toEqual(Object.keys(scores).sort());
        for (const entry of board) expect(entry.score).toBe(scores[entry.playerId]);
        for (let i = 1; i < board.length; ++i) {
          const prev = board[i - 1];
          const cur = board[i];
          if (prev === undefined || cur === undefined) throw new Error("index out of range");
          expect(prev.score >= cur.score).toBe(true);
          if (prev.score === cur.score) {
            expect(prev.playerId.localeCompare(cur.playerId)).toBeLessThan(0);
          }
        }
        const reversed = Object.fromEntries(Object.entries(scores).reverse());
        expect(leaderboard(reversed)).toEqual(board);
      }),
      { numRuns: 200 },
    );
  });
});

describe("composeLeaderboard properties", () => {
  it("lists every id once, seated before leavers, each group sorted", () => {
    fc.assert(
      fc.property(scoreMap, ids, fc.nat(), (scores, extraIds, seatMask) => {
        const everyone = [...new Set([...Object.keys(scores), ...extraIds])];
        const seated = new Map(
          everyone.filter((_, i) => (seatMask >> i) & 1).map((id) => [id, `n-${id}`] as const),
        );
        const board = composeLeaderboard({
          scores,
          seatedNames: seated,
          rememberedNames: {},
          ids: extraIds,
        });
        expect(board.map((e) => e.playerId).sort()).toEqual([...everyone].sort());
        for (const entry of board) {
          expect(entry.score).toBe(scores[entry.playerId] ?? 0);
          expect(entry.hasLeft).toBe(!seated.has(entry.playerId));
        }
        const firstLeaver = board.findIndex((e) => e.hasLeft);
        if (firstLeaver >= 0) expect(board.slice(firstLeaver).every((e) => e.hasLeft)).toBe(true);
        for (const group of [board.filter((e) => !e.hasLeft), board.filter((e) => e.hasLeft)]) {
          expect(group).toEqual(
            [...group].sort((a, b) => b.score - a.score || a.playerId.localeCompare(b.playerId)),
          );
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe("awardPoints properties", () => {
  it("never lowers a score for non-negative awards and sums them", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.constantFrom("a", "b", "c"), fc.nat(10_000)), { maxLength: 30 }),
        (awards) => {
          const scores: Record<string, number> = {};
          for (const [id, points] of awards) {
            const before = scores[id] ?? 0;
            awardPoints(scores, id, points);
            expect(scores[id]).toBeGreaterThanOrEqual(before);
          }
          for (const id of Object.keys(scores)) {
            const total = awards.filter(([who]) => who === id).reduce((n, [, p]) => n + p, 0);
            expect(scores[id]).toBe(total);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
