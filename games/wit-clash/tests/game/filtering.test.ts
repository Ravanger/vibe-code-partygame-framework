import { describe, expect, it } from "vitest";
import { makeCategories, nth, Table, type TableConfig } from "./support.js";

const PROFANE = "what the fuck";
const MILD = "you ass";

const submitFirst = (t: Table, playerId: string, answer: string) => {
  const matchupId = nth([...t.mine(playerId).prompts], 0).matchupId;
  return t.act(playerId, "SUBMIT_ANSWER", { matchupId, answer });
};

const finalRound = (config: TableConfig = {}): TableConfig => ({
  players: 4,
  categories: makeCategories(4, 8, 3),
  ...config,
  options: { totalRounds: 1, ...config.options },
});

const topTwo = { p1: 500, p2: 500, p3: 100, p4: 0 };

/** Plays the final round out with `topTwo` standing at its last reveal; stops at whatever follows. */
function toTieBreaker(config: TableConfig = {}): Table {
  const t = new Table(finalRound(config));
  t.toVoting();
  for (;;) {
    if (t.phase === "MatchupVoting") {
      t.voteFor(nth(t.authors(), 0));
    } else if (t.phase === "MatchupReveal") {
      if (t.state.activeMatchupIndex + 1 === t.state.matchups.length) t.priv.scores = { ...topTwo };
      t.tick(5000);
    } else {
      return t;
    }
  }
}

describe("answer filtering", () => {
  it("refuses a profane answer at the default moderate level and stores nothing", () => {
    const t = new Table();
    t.toPrompting();
    const matchupId = nth([...t.mine("p1").prompts], 0).matchupId;
    const error = submitFirst(t, "p1", PROFANE);
    expect(error).toEqual({
      code: "CONTENT_REJECTED",
      message: "contains inappropriate language",
      action: "SUBMIT_ANSWER",
    });
    expect(t.errors("p1")).toContainEqual(error);
    expect(t.state.progress.get("p1")).toBe(0);
    expect(t.priv.drafts.get("p1")?.get(matchupId)).toBeUndefined();
  });

  it("accepts the same answer when filtering is off", () => {
    const t = new Table({ options: { filterLevel: "off" } });
    t.toPrompting();
    expect(submitFirst(t, "p1", PROFANE)).toBeUndefined();
    expect(t.errors("p1")).toEqual([]);
    const matchupId = nth([...t.mine("p1").prompts], 0).matchupId;
    expect(t.priv.drafts.get("p1")?.get(matchupId)).toBe(PROFANE);
  });

  it("passes a mild term at moderate and refuses it at strict", () => {
    const t = new Table();
    t.toPrompting();
    expect(submitFirst(t, "p1", MILD)).toBeUndefined();
    expect(t.errors("p1")).toEqual([]);

    const s = new Table({ options: { filterLevel: "strict" } });
    s.toPrompting();
    expect(submitFirst(s, "p1", MILD)).toEqual({
      code: "CONTENT_REJECTED",
      message: "contains strong language",
      action: "SUBMIT_ANSWER",
    });
  });

  it("applies a level the host raises in the lobby to later answers", () => {
    const t = new Table();
    t.act("p1", "SET_OPTIONS", { filterLevel: "strict" });
    t.toPrompting();
    expect(submitFirst(t, "p1", MILD)).toEqual({
      code: "CONTENT_REJECTED",
      message: "contains strong language",
      action: "SUBMIT_ANSWER",
    });
  });

  it("keeps filtering the tie-breaker answers", () => {
    const t = toTieBreaker();
    expect(t.phase).toBe("TieBreakerPrompting");
    const error = submitFirst(t, "p1", PROFANE);
    expect(error?.code).toBe("CONTENT_REJECTED");
    expect(t.state.progress.get("p1")).toBe(0);

    const off = toTieBreaker({ options: { filterLevel: "off" } });
    expect(submitFirst(off, "p1", PROFANE)).toBeUndefined();
  });
});
