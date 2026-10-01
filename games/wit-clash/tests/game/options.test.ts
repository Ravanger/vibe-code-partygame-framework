import { describe, expect, it } from "vitest";
import { categoriesFromArray } from "../../src/content/CategoryRepository.js";
import { createWitClashGame } from "../../src/game.js";
import { WitClashOptionsSchema } from "../../src/options.js";
import { makeCategories, Table } from "./support.js";

describe("WitClashOptionsSchema", () => {
  it("defaults to 3 rounds and the standard timers", () => {
    expect(WitClashOptionsSchema.parse({})).toEqual({
      totalRounds: 3,
      categoryVoteSeconds: 60,
      promptSeconds: 90,
      voteSeconds: 20,
      revealSeconds: 5,
    });
  });

  it.each([
    { totalRounds: 0 },
    { totalRounds: 11 },
    { totalRounds: 1.5 },
    { categoryVoteSeconds: 2 },
    { promptSeconds: 1000 },
    { voteSeconds: 0 },
    { revealSeconds: 0 },
    { revealSeconds: 60 },
  ])("rejects %o", (bad) => {
    expect(WitClashOptionsSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts a one-second reveal", () => {
    expect(WitClashOptionsSchema.parse({ revealSeconds: 1 }).revealSeconds).toBe(1);
  });
});

describe("room options", () => {
  it("are validated when the room is created", () => {
    expect(() => new Table({ options: { totalRounds: 99 } })).toThrow();
  });

  it("can be changed by the host in the lobby and apply to the next game", () => {
    const t = new Table({ players: 3 });
    t.act("p1", "SET_OPTIONS", { totalRounds: 1, promptSeconds: 30 });
    expect(t.host.published).toEqual([
      expect.objectContaining({ totalRounds: 1, promptSeconds: 30 }),
    ]);
    t.start();
    expect(t.state.totalRounds).toBe(1);
    t.voteFirstCategory();
    expect(t.state.phaseEndsAt - t.host.time).toBe(30_000);
  });

  it("refuses an invalid change and leaves the options alone", () => {
    const t = new Table({ players: 3 });
    t.act("p1", "SET_OPTIONS", { totalRounds: 50 });
    expect(t.errors("p1")).toMatchObject([{ code: "INVALID_ACTION" }]);
    expect(t.host.published).toEqual([]);
  });

  it("are not changeable once the game has started", () => {
    const t = new Table({ players: 3 });
    t.start();
    t.act("p1", "SET_OPTIONS", { totalRounds: 1 });
    expect(t.errors("p1")).toMatchObject([{ code: "WRONG_PHASE" }]);
  });
});

describe("createWitClashGame", () => {
  it("refuses to build a game without categories", () => {
    expect(() => createWitClashGame({ categories: categoriesFromArray([]) })).toThrow(
      /at least one category/,
    );
  });

  it("describes the game to the framework", () => {
    const game = createWitClashGame({ categories: makeCategories() });
    expect(game).toMatchObject({
      name: "WitClash",
      minPlayers: 3,
      maxPlayers: 8,
      startPhase: "CategorySelection",
    });
    expect(Object.keys(game.phases)).toEqual([
      "CategorySelection",
      "Prompting",
      "MatchupVoting",
      "MatchupReveal",
      "TieBreakerPrompting",
      "TieBreakerVoting",
      "TieBreakerReveal",
      "Results",
    ]);
  });
});
