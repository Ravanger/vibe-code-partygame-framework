import { getActionLog } from "@partygame/core";
import { replayLog } from "@partygame/core/testing";
import { describe, expect, it } from "vitest";
import { categoriesFromArray } from "../../src/content/CategoryRepository.js";
import { utcDay } from "../../src/dailySeed.js";
import { createWitClashGame } from "../../src/game.js";
import { WitClashOptionsSchema } from "../../src/options.js";
import { WitClashState } from "../../src/state.js";
import { makeCategories, nth, Table } from "./support.js";

/** 2026-10-15 23:50 UTC: the same date for every daily table in this file. */
const DAY = Date.UTC(2026, 9, 15, 23, 50);

const dailyTable = (seed: number, startTime = DAY) =>
  new Table({
    players: 4,
    seed,
    startTime,
    options: { mode: "daily", totalRounds: 2 },
  });

const roundContent = (t: Table): { category: string; prompts: string[] } => ({
  category: t.state.selectedCategory,
  prompts: [...t.state.matchups].map((m) => m.promptText),
});

/** Answers and votes out the current round; the table ends in Results. */
const playRound = (t: Table): { category: string; prompts: string[] } => {
  const content = roundContent(t);
  t.answerEverything();
  t.playOutVoting();
  return content;
};

describe("daily mode", () => {
  it("deals the same categories and prompt texts in every round for the same UTC date, whatever the room seed", () => {
    const a = dailyTable(1234);
    const b = dailyTable(9876);
    a.start();
    b.start();
    expect(a.state.phase).toBe("Prompting");
    expect(b.state.categoryOptions.length).toBe(0);
    const roundsA: unknown[] = [];
    const roundsB: unknown[] = [];
    for (let i = 0; i < 2; ++i) {
      roundsA.push(playRound(a));
      roundsB.push(playRound(b));
      if (i < 1) {
        a.act("p1", "NEXT_ROUND");
        b.act("p1", "NEXT_ROUND");
      }
    }
    expect(roundsA).toEqual(roundsB);
    const first = roundsA[0] as { category: string; prompts: string[] };
    expect(first.category).toMatch(/^cat-/);
    expect(first.prompts.length).toBe(4);
  });

  it("deals different content on a different UTC date", () => {
    const a = dailyTable(1234, DAY);
    const b = dailyTable(1234, DAY + 86_400_000);
    a.start();
    b.start();
    const categoriesA: string[] = [];
    const categoriesB: string[] = [];
    for (let i = 0; i < 2; ++i) {
      categoriesA.push(playRound(a).category);
      categoriesB.push(playRound(b).category);
      if (i < 1) {
        a.act("p1", "NEXT_ROUND");
        b.act("p1", "NEXT_ROUND");
      }
    }
    expect(categoriesA).not.toEqual(categoriesB);
  });

  it("keeps the category vote in free mode and skips it in daily mode", () => {
    const free = new Table({ players: 4 });
    free.start();
    expect(free.state.phase).toBe("CategorySelection");
    expect(free.state.categoryOptions.length).toBe(3);

    const daily = dailyTable(1234);
    daily.start();
    expect(daily.state.phase).toBe("Prompting");
    expect(daily.state.categoryOptions.length).toBe(0);
    expect(daily.state.selectedCategory).not.toBe("");
  });

  it("plays the canon repository, not the host-editable content", () => {
    const canon = categoriesFromArray(
      ["alpha", "beta", "gamma"].map((id) => ({
        id,
        name: id,
        emoji: "x",
        prompts: Array.from({ length: 8 }, (_, p) => ({
          id: `${id}-p${p}`,
          text: `Can ${id}.${p}`,
        })),
        tieBreakers: [],
        weight: 1,
        rating: "family",
      })),
    );
    const t = new Table({
      players: 4,
      seed: 7,
      startTime: DAY,
      categories: makeCategories(6),
      canon,
      options: { mode: "daily", totalRounds: 1 },
    });
    t.start();
    expect(t.state.selectedCategory).toMatch(/^(alpha|beta|gamma)$/);
  });

  it("deals tie-breaker prompts from the canon too", () => {
    const canon = categoriesFromArray([
      {
        id: "alpha",
        name: "alpha",
        emoji: "x",
        prompts: Array.from({ length: 8 }, (_, p) => ({
          id: `alpha-p${p}`,
          text: `Can alpha.${p}`,
        })),
        tieBreakers: [{ id: "alpha-tb0", text: "Canon tie-breaker." }],
        weight: 1,
        rating: "family",
      },
    ]);
    const t = new Table({
      players: 4,
      seed: 7,
      startTime: DAY,
      categories: makeCategories(6), // no tie-breakers of its own
      canon,
      options: { mode: "daily", totalRounds: 1 },
    });
    t.start();
    t.answerEverything();
    for (;;) {
      if (t.phase === "MatchupVoting") t.voteFor(nth(t.authors(), 0));
      else if (t.phase === "MatchupReveal") {
        if (t.state.activeMatchupIndex + 1 === t.state.matchups.length) {
          t.priv.scores = { p1: 500, p2: 500, p3: 100, p4: 0 };
        }
        t.tick(5000);
      } else break;
    }
    expect(t.phase).toBe("TieBreakerPrompting");
    const tieBreaker = t.state.tieBreakers[t.state.tieBreakers.length - 1];
    expect(tieBreaker?.promptText).toBe("Canon tie-breaker.");
  });

  it("keeps the date it started with across UTC midnight", () => {
    const t = dailyTable(1234, DAY);
    t.start();
    expect(t.priv.dailyDay).toBe(utcDay(DAY));
    playRound(t);
    // Results has no timer, so the clock can jump without firing a stale phase timeout.
    t.host.time = Date.UTC(2026, 9, 16, 0, 30);
    t.act("p1", "NEXT_ROUND");
    expect(t.priv.dailyDay).toBe(utcDay(DAY));

    const reference = dailyTable(1234, DAY);
    reference.start();
    playRound(reference);
    reference.act("p1", "NEXT_ROUND");
    expect(roundContent(t)).toEqual(roundContent(reference));
  });

  it("replays a daily game to the same final state", () => {
    const definition = createWitClashGame({ categories: makeCategories(6, 8) });
    const options = WitClashOptionsSchema.parse({ mode: "daily", totalRounds: 1 });
    const t = new Table({ players: 4, seed: 42, startTime: DAY, options, definition });
    t.start();
    playRound(t);
    expect(t.state.phase).toBe("Results");

    const log = getActionLog(t.priv);
    if (log === undefined) throw new Error("expected an action log");
    const replayed = replayLog(definition, log, { state: new WitClashState(), options });
    const last = replayed.states[replayed.states.length - 1];
    expect(last?.phase).toBe("Results");
    expect(last?.selectedCategory).toBe(t.state.selectedCategory);
    expect([...(last?.matchups ?? [])].map((m) => m.promptText)).toEqual(
      [...t.state.matchups].map((m) => m.promptText),
    );
    expect([...(last?.scoreboard ?? [])].map((s) => [s.playerId, s.score])).toEqual(
      [...t.state.scoreboard].map((s) => [s.playerId, s.score]),
    );
  });
});
