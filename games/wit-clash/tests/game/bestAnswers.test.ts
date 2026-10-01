import { describe, expect, it } from "vitest";
import { type AnswerRecord, pickBestAnswers } from "../../src/bestAnswers.js";
import { nth, Table } from "./support.js";

const record = (id: string, votes: number, matchupVotes: number): AnswerRecord => ({
  text: `answer ${id}`,
  authorId: id,
  authorName: id,
  promptText: "prompt",
  votes,
  matchupVotes,
});

describe("pickBestAnswers", () => {
  it("is empty when nothing got a vote", () => {
    expect(pickBestAnswers([])).toEqual([]);
    expect(pickBestAnswers([record("a", 0, 0)])).toEqual([]);
  });

  it("prefers the higher vote share over raw votes", () => {
    const best = pickBestAnswers([record("a", 3, 6), record("b", 2, 2), record("c", 1, 4)]);
    expect(best.map((r) => r.authorId)).toEqual(["b"]);
  });

  it("breaks an equal share by raw votes", () => {
    const best = pickBestAnswers([record("a", 1, 2), record("b", 2, 4), record("c", 3, 6)]);
    expect(best.map((r) => r.authorId)).toEqual(["c"]);
  });

  it("lists every answer that is level on both", () => {
    const best = pickBestAnswers([record("a", 2, 2), record("b", 2, 2), record("c", 1, 2)]);
    expect(best.map((r) => r.authorId).sort()).toEqual(["a", "b"]);
  });
});

describe("the best answer of a game", () => {
  const play = (totalRounds: number) => {
    const t = new Table({ options: { totalRounds } });
    t.toVoting();
    let first = true;
    for (;;) {
      if (t.phase === "MatchupVoting") {
        if (first) {
          t.voteFor(nth(t.authors(), 0));
          first = false;
        } else {
          const [a, b] = t.authors() as [string, string];
          const [x, y] = t.eligible() as [string, string];
          t.act(x, "CAST_VOTE", { answerId: t.answerBy(a) });
          t.act(y, "CAST_VOTE", { answerId: t.answerBy(b) });
        }
      } else if (t.phase === "MatchupReveal") t.tick(5000);
      else return t;
    }
  };

  it("is published with the results of the final round", () => {
    const t = play(1);
    expect(t.phase).toBe("Results");
    expect(t.state.bestAnswers).toHaveLength(1);
    const best = nth([...t.state.bestAnswers], 0);
    expect(best.votes).toBe(2);
    expect(best.promptText).toMatch(/^Prompt /);
    expect(best.text).toContain(best.authorId);
    expect(best.authorName).toBe(best.authorId);
  });

  it("waits for the final round", () => {
    const t = play(2);
    expect(t.state.bestAnswers).toHaveLength(0);
  });

  it("ignores forfeits", () => {
    const t = new Table({ options: { totalRounds: 1 } });
    t.toPrompting();
    t.act("p1", "SUBMIT_ANSWER", {
      matchupId: nth([...t.mine("p1").prompts], 0).matchupId,
      answer: "alone",
    });
    t.tick(90_000);
    t.playOutVoting();
    expect(t.phase).toBe("Results");
    expect(t.state.bestAnswers.every((a) => a.text !== "alone")).toBe(true);
  });

  it("is forgotten on PLAY_AGAIN", () => {
    const t = play(1);
    t.act("p1", "PLAY_AGAIN");
    expect(t.state.bestAnswers).toHaveLength(0);
    expect(t.priv.answerHistory).toEqual([]);
  });
});
