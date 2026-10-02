import { describe, expect, it } from "vitest";
import { makeCategories, nth, Table } from "./support.js";

const typing = (t: Table): string[] => [...t.state.typing.keys()];

const submitPrompt = (t: Table, playerId: string, index: number): void => {
  t.act(playerId, "SUBMIT_ANSWER", {
    matchupId: nth([...t.mine(playerId).prompts], index).matchupId,
    answer: `${playerId} ${index}`,
  });
};

describe("SET_TYPING while answering prompts", () => {
  it("publishes who is typing and who stopped", () => {
    const t = new Table();
    t.toPrompting();
    t.act("p1", "SET_TYPING", { typing: true });
    t.act("p2", "SET_TYPING", { typing: true });
    expect(typing(t)).toEqual(["p1", "p2"]);
    expect(t.state.typing.get("p1")).toBe(true);
    t.act("p1", "SET_TYPING", { typing: false });
    expect(typing(t)).toEqual(["p2"]);
  });

  it("clears a player once all of their answers are in", () => {
    const t = new Table();
    t.toPrompting();
    t.act("p1", "SET_TYPING", { typing: true });
    submitPrompt(t, "p1", 0);
    expect(typing(t)).toEqual(["p1"]);
    submitPrompt(t, "p1", 1);
    expect(typing(t)).toEqual([]);
  });

  it("clears everyone when the phase ends", () => {
    const t = new Table();
    t.toPrompting();
    t.act("p1", "SET_TYPING", { typing: true });
    t.act("p3", "SET_TYPING", { typing: true });
    t.tick(90_000);
    expect(t.phase).not.toBe("Prompting");
    expect(typing(t)).toEqual([]);
  });

  it("clears a player who leaves", () => {
    const t = new Table();
    t.toPrompting();
    t.act("p4", "SET_TYPING", { typing: true });
    t.leave("p4");
    expect(typing(t)).toEqual([]);
  });

  it("refuses a player with nothing to answer", () => {
    const t = new Table();
    t.toPrompting();
    t.joinLate("p9");
    t.act("p9", "SET_TYPING", { typing: true });
    expect(typing(t)).toEqual([]);
    expect(t.errors("p9")).toHaveLength(1);
  });

  it("rejects a malformed payload", () => {
    const t = new Table();
    t.toPrompting();
    t.act("p1", "SET_TYPING", { typing: "yes" });
    expect(typing(t)).toEqual([]);
    expect(t.errors("p1")).toHaveLength(1);
  });

  it("is not accepted while voting", () => {
    const t = new Table();
    t.toVoting();
    t.act("p1", "SET_TYPING", { typing: true });
    expect(typing(t)).toEqual([]);
    expect(t.errors("p1")).toHaveLength(1);
  });
});

describe("SET_TYPING in the tie-breaker", () => {
  const tied = () => {
    const t = new Table({
      players: 4,
      categories: makeCategories(4, 8, 3),
      options: { totalRounds: 1 },
    });
    t.toVoting();
    for (;;) {
      if (t.phase === "MatchupVoting") t.voteFor(nth(t.authors(), 0));
      else if (t.phase === "MatchupReveal") {
        if (t.state.activeMatchupIndex + 1 === t.state.matchups.length) {
          t.priv.scores = { p1: 500, p2: 500, p3: 100, p4: 0 };
        }
        t.tick(5000);
      } else return t;
    }
  };

  it("lets contenders only, and clears on submit and on timeout", () => {
    const t = tied();
    expect(t.phase).toBe("TieBreakerPrompting");
    t.act("p3", "SET_TYPING", { typing: true });
    expect(t.errors("p3")).toMatchObject([{ code: "NOT_ALLOWED" }]);
    t.act("p1", "SET_TYPING", { typing: true });
    t.act("p2", "SET_TYPING", { typing: true });
    expect(typing(t)).toEqual(["p1", "p2"]);
    submitPrompt(t, "p1", 0);
    expect(typing(t)).toEqual(["p2"]);
    t.tick(90_000);
    expect(typing(t)).toEqual([]);
  });

  it("clears when the tie-breaker ends early", () => {
    const t = tied();
    t.act("p1", "SET_TYPING", { typing: true });
    t.leave("p2");
    expect(t.phase).toBe("Results");
    expect(typing(t)).toEqual([]);
  });
});
