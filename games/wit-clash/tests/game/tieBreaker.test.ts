import { required } from "@partygame/core";
import { describe, expect, it } from "vitest";
import { makeCategories, nth, Table, type TableConfig } from "./support.js";

const finalRound = (config: TableConfig = {}): TableConfig => ({
  players: 4,
  categories: makeCategories(4, 8, 3),
  ...config,
  options: { totalRounds: 1, ...config.options },
});

/** Plays the round out with `scores` standing at its last reveal; stops at whatever follows. */
function toTieBreaker(scores: Record<string, number>, config: TableConfig = {}): Table {
  const t = new Table(finalRound(config));
  t.toVoting();
  for (;;) {
    if (t.phase === "MatchupVoting") {
      t.voteFor(nth(t.authors(), 0));
    } else if (t.phase === "MatchupReveal") {
      if (t.state.activeMatchupIndex + 1 === t.state.matchups.length) t.priv.scores = { ...scores };
      t.tick(5000);
    } else {
      return t;
    }
  }
}

const everyoneTied = { p1: 500, p2: 500, p3: 500, p4: 500 };
const threeTied = { p1: 500, p2: 500, p3: 500, p4: 100 };
const fourTied = { p1: 500, p2: 500, p3: 500, p4: 500, p5: 0 };
const fiveSeats: TableConfig = { players: 5 };
const topTwo = { p1: 500, p2: 500, p3: 100, p4: 0 };

const current = (t: Table) => required(t.state.tieBreakers[t.state.tieBreakers.length - 1], "tb");

const submit = (t: Table, playerId: string, answer = `${playerId} says hi`): void =>
  t.act(playerId, "SUBMIT_ANSWER", {
    matchupId: nth([...t.mine(playerId).prompts], 0).matchupId,
    answer,
  });

const answerBy = (t: Table, playerId: string): string =>
  required(
    current(t).answers.find((a) => t.priv.authors.get(a.id) === playerId),
    "answer",
  ).id;

const contenders = (t: Table): string[] => [...t.state.tieBreakerContenders];

describe("when the tie-breaker starts", () => {
  it("goes straight to Results when one player leads", () => {
    const t = toTieBreaker({ p1: 500, p2: 400 });
    expect(t.phase).toBe("Results");
    expect(t.state.tieBreakers).toHaveLength(0);
  });

  it("does not run before the final round", () => {
    const t = new Table({ ...finalRound(), options: { totalRounds: 2 } });
    t.toVoting();
    for (;;) {
      if (t.phase === "MatchupVoting") t.voteFor(nth(t.authors(), 0));
      else if (t.phase === "MatchupReveal") {
        if (t.state.activeMatchupIndex + 1 === t.state.matchups.length) t.priv.scores = { p1: 5 };
        t.tick(5000);
      } else break;
    }
    expect(t.phase).toBe("Results");
  });

  it("skips it when the content has no tie-breaker prompt", () => {
    const t = toTieBreaker(topTwo, { categories: makeCategories() });
    expect(t.phase).toBe("Results");
  });

  it("is skipped when everyone standing is tied, as a shared win", () => {
    const t = toTieBreaker(everyoneTied);
    expect(t.phase).toBe("Results");
    expect(t.state.tieBreakers).toHaveLength(0);
    expect(t.priv.tieBreakerWinnerId).toBe("");
    expect(t.priv.scores).toEqual(everyoneTied);
    expect(t.state.scoreboard.some((e) => e.wonTieBreaker)).toBe(false);
  });

  it("is skipped when the whole room is level", () => {
    const scores = { p1: 500, p2: 500, p3: 500 };
    const t = toTieBreaker(scores, { players: 3 });
    expect(t.phase).toBe("Results");
    expect(t.state.tieBreakers).toHaveLength(0);
    expect(t.priv.tieBreakerWinnerId).toBe("");
    expect(t.priv.scores).toEqual(scores);
  });

  it("only counts players who are still seated and active", () => {
    const t = new Table(finalRound());
    t.toVoting();
    for (;;) {
      if (t.phase === "MatchupVoting") t.voteFor(nth(t.authors(), 0));
      else if (t.phase === "MatchupReveal") {
        if (t.state.activeMatchupIndex + 1 === t.state.matchups.length) {
          t.priv.scores = { p1: 900, p2: 500, p3: 100, p4: 100 };
          t.leave("p1");
        }
        t.tick(5000);
      } else break;
    }
    expect(t.phase).toBe("Results");
  });

  it("starts with every tied player as a contender, answering the prompt", () => {
    const t = toTieBreaker(topTwo);
    expect(t.phase).toBe("TieBreakerPrompting");
    expect(contenders(t)).toEqual(["p1", "p2"]);
    expect(current(t).promptText).toMatch(/^Tie-breaker /);
    expect(t.state.phaseEndsAt - t.host.time).toBe(90_000);
    expect(t.mine("p1").prompts).toHaveLength(1);
    expect(t.mine("p2").prompts).toHaveLength(1);
    expect(t.mine("p3").prompts).toHaveLength(0);
    expect(t.state.progress.get("p1")).toBe(0);
  });

  it("takes the prompt from the category that was played", () => {
    const t = toTieBreaker(topTwo);
    const category = required(t.priv.content.byId(t.priv.categoryId), "category");
    expect(category.tieBreakers.map((p) => p.text)).toContain(current(t).promptText);
    const picked = category.tieBreakers.find((p) => p.text === current(t).promptText);
    expect(t.priv.usedPromptIds.has(required(picked, "prompt").id)).toBe(true);
  });

  it("falls back to other categories once the played one has none left", () => {
    const t = new Table(finalRound());
    t.toVoting();
    const played = required(t.priv.content.byId(t.priv.categoryId), "category");
    for (const p of played.tieBreakers) t.priv.usedPromptIds.add(p.id);
    for (;;) {
      if (t.phase === "MatchupVoting") t.voteFor(nth(t.authors(), 0));
      else if (t.phase === "MatchupReveal") {
        if (t.state.activeMatchupIndex + 1 === t.state.matchups.length) t.priv.scores = topTwo;
        t.tick(5000);
      } else break;
    }
    expect(t.phase).toBe("TieBreakerPrompting");
    const used = [...t.priv.usedPromptIds].filter((id) => id.includes("-tb"));
    expect(used).toHaveLength(played.tieBreakers.length + 1);
    expect(played.tieBreakers.map((p) => p.text)).not.toContain(current(t).promptText);
  });
});

describe("answering the tie-breaker", () => {
  it("lets only contenders answer", () => {
    const t = toTieBreaker(topTwo);
    t.act("p3", "SUBMIT_ANSWER", { matchupId: current(t).id, answer: "nope" });
    expect(t.errors("p3")).toMatchObject([{ code: "NOT_ALLOWED" }]);
  });

  it("moves to voting when every contender has answered", () => {
    const t = toTieBreaker(topTwo);
    submit(t, "p1");
    expect(t.phase).toBe("TieBreakerPrompting");
    expect(t.state.progress.get("p1")).toBe(1);
    expect(t.mine("p1").prompts[0]?.submitted).toBe(true);
    submit(t, "p2");
    expect(t.phase).toBe("TieBreakerVoting");
    expect(current(t).answers).toHaveLength(2);
  });

  it("hides authors and votes until the reveal", () => {
    const t = toTieBreaker(topTwo);
    submit(t, "p1");
    submit(t, "p2");
    for (const a of current(t).answers) {
      expect(a.authorId).toBe("");
      expect(a.authorName).toBe("");
      expect(a.votes).toBe(0);
    }
    expect(current(t).isRevealed).toBe(false);
  });

  it("goes on with the answers it has when time runs out", () => {
    const t = toTieBreaker(fourTied, fiveSeats);
    submit(t, "p1");
    submit(t, "p2");
    submit(t, "p3");
    t.tick(90_000);
    expect(t.phase).toBe("TieBreakerVoting");
    expect(current(t).answers).toHaveLength(3);
    expect(current(t).isForfeit).toBe(false);
  });

  it("gives a lone answer the win without a vote", () => {
    const t = toTieBreaker(topTwo);
    submit(t, "p2");
    t.tick(90_000);
    expect(t.phase).toBe("TieBreakerReveal");
    expect(current(t).isForfeit).toBe(true);
    expect(current(t).answers[0]).toMatchObject({ authorName: "p2", isWinner: true });
    expect(t.priv.scores.p2).toBe(501);
    expect(t.priv.tieBreakerWinnerId).toBe("p2");
  });

  it("ends as a shared win when nobody answers", () => {
    const t = toTieBreaker(topTwo);
    t.tick(90_000);
    expect(t.phase).toBe("Results");
    expect(t.priv.tieBreakerWinnerId).toBe("");
    expect(t.state.scoreboard.some((e) => e.wonTieBreaker)).toBe(false);
  });

  it("does not wait for a contender who is offline", () => {
    const t = toTieBreaker(threeTied);
    t.drop("p3");
    submit(t, "p1");
    expect(t.phase).toBe("TieBreakerPrompting");
    submit(t, "p2");
    expect(t.phase).toBe("TieBreakerVoting");
  });
});

describe("voting on the tie-breaker", () => {
  const voting = (scores: Record<string, number>, config: TableConfig = {}) => {
    const t = toTieBreaker(scores, config);
    for (const id of contenders(t)) submit(t, id);
    return t;
  };

  it("is open to everyone outside the tie", () => {
    const t = voting(topTwo);
    expect(t.state.phaseEndsAt - t.host.time).toBe(20_000);
    expect(t.state.votesExpected).toBe(2);
    expect(t.mine("p3").canVote).toBe(true);
    expect(t.mine("p4").canVote).toBe(true);
    expect(t.mine("p1").canVote).toBe(false);
    expect(t.mine("p1").isOwnMatchup).toBe(true);
    expect(t.mine("p3").isOwnMatchup).toBe(false);
    expect(t.mine("p1").ownAnswerId).toBe(answerBy(t, "p1"));
    expect(t.mine("p3").ownAnswerId).toBe("");
  });

  it("refuses contenders, and unknown answers", () => {
    const t = voting(topTwo);
    t.act("p1", "CAST_VOTE", { answerId: answerBy(t, "p2") });
    t.act("p1", "CAST_VOTE", { answerId: answerBy(t, "p1") });
    expect(t.errors("p1")).toMatchObject([{ code: "NOT_ALLOWED" }, { code: "NOT_ALLOWED" }]);
    expect(t.state.votesCast).toBe(0);
    t.act("p3", "CAST_VOTE", { answerId: "missing" });
    expect(t.errors("p3")).toMatchObject([{ code: "INVALID_ACTION" }]);
  });

  it("reveals when the last vote is in", () => {
    const t = voting(topTwo);
    t.act("p3", "CAST_VOTE", { answerId: answerBy(t, "p1") });
    expect(t.phase).toBe("TieBreakerVoting");
    t.act("p4", "CAST_VOTE", { answerId: answerBy(t, "p1") });
    expect(t.phase).toBe("TieBreakerReveal");
  });

  it("reveals at the deadline", () => {
    const t = voting(topTwo);
    t.tick(20_000);
    expect(t.phase).toBe("TieBreakerReveal");
  });

  it("recounts when a voter leaves", () => {
    const t = voting(topTwo);
    t.act("p3", "CAST_VOTE", { answerId: answerBy(t, "p1") });
    t.leave("p4");
    expect(t.phase).toBe("TieBreakerReveal");
  });

  it("recounts without revealing while voters remain", () => {
    const t = voting(topTwo, { players: 5 });
    t.act("p3", "CAST_VOTE", { answerId: answerBy(t, "p1") });
    t.leave("p4");
    expect(t.phase).toBe("TieBreakerVoting");
    expect(t.state.votesExpected).toBe(2);
  });

  it("ends as a shared win when every voter leaves", () => {
    const t = voting(topTwo);
    t.leave("p3");
    expect(t.phase).toBe("TieBreakerVoting");
    t.drop("p4");
    expect(t.phase).toBe("Results");
    expect(t.priv.tieBreakerWinnerId).toBe("");
    expect(t.state.tieBreakers).toHaveLength(1);
    expect(t.state.scoreboard.some((e) => e.wonTieBreaker)).toBe(false);
  });

  it("leaves a late joiner out", () => {
    const t = voting(topTwo);
    t.joinLate("p9");
    expect(t.state.mine.has("p9")).toBe(false);
    expect(t.phase).toBe("TieBreakerVoting");
  });
});

describe("the tie-breaker verdict", () => {
  const revealed = (winner: string, config: TableConfig = {}) => {
    const t = toTieBreaker(topTwo, config);
    for (const id of contenders(t)) submit(t, id);
    for (const voter of ["p3", "p4"]) t.act(voter, "CAST_VOTE", { answerId: answerBy(t, winner) });
    return t;
  };

  it("shows authors and votes, awards the winner a point and marks them", () => {
    const t = revealed("p2");
    expect(t.phase).toBe("TieBreakerReveal");
    expect(current(t).isRevealed).toBe(true);
    const winner = required(
      current(t).answers.find((a) => a.isWinner),
      "winner",
    );
    expect(winner).toMatchObject({ authorId: "p2", authorName: "p2", votes: 2 });
    expect(t.priv.scores.p2).toBe(501);
    expect(t.state.votesCast).toBe(2);
    t.tick(5000);
    expect(t.phase).toBe("Results");
    const rows = [...t.state.scoreboard];
    expect(rows.filter((e) => e.wonTieBreaker).map((e) => e.playerId)).toEqual(["p2"]);
    expect(nth(rows, 0).playerId).toBe("p2");
  });

  it("plays a new prompt among the players still level", () => {
    const t = toTieBreaker(topTwo);
    for (const id of contenders(t)) submit(t, id);
    const first = current(t).promptText;
    t.act("p3", "CAST_VOTE", { answerId: answerBy(t, "p1") });
    t.act("p4", "CAST_VOTE", { answerId: answerBy(t, "p2") });
    expect(t.phase).toBe("TieBreakerReveal");
    expect(t.priv.tieBreakerWinnerId).toBe("");
    t.tick(5000);
    expect(t.phase).toBe("TieBreakerPrompting");
    expect(contenders(t)).toEqual(expect.arrayContaining(["p1", "p2"]));
    expect(contenders(t)).toHaveLength(2);
    expect(t.state.tieBreakers).toHaveLength(2);
    expect(current(t).promptText).not.toBe(first);
    expect(t.mine("p3").prompts).toHaveLength(0);
    expect(t.mine("p1").matchupVote).toBe("");
    expect(t.mine("p1").prompts).toHaveLength(1);
  });

  it("repeats until someone wins", () => {
    const t = toTieBreaker(topTwo);
    for (const id of contenders(t)) submit(t, id);
    t.act("p3", "CAST_VOTE", { answerId: answerBy(t, "p1") });
    t.act("p4", "CAST_VOTE", { answerId: answerBy(t, "p2") });
    t.tick(5000);
    for (const id of contenders(t)) submit(t, id);
    t.act("p3", "CAST_VOTE", { answerId: answerBy(t, "p2") });
    t.act("p4", "CAST_VOTE", { answerId: answerBy(t, "p2") });
    t.tick(5000);
    expect(t.phase).toBe("Results");
    expect(t.priv.tieBreakerWinnerId).toBe("p2");
  });

  it("ends as a shared win when a tie has no prompt left", () => {
    const categories = makeCategories(4, 8, 0);
    nth(categories.all(), 0).tieBreakers.push({ id: "only", text: "The only one" });
    const t = toTieBreaker(topTwo, { categories });
    expect(t.phase).toBe("TieBreakerPrompting");
    for (const id of contenders(t)) submit(t, id);
    t.act("p3", "CAST_VOTE", { answerId: answerBy(t, "p1") });
    t.act("p4", "CAST_VOTE", { answerId: answerBy(t, "p2") });
    t.tick(5000);
    expect(t.phase).toBe("Results");
    expect(t.priv.tieBreakerWinnerId).toBe("");
    expect(t.state.scoreboard.some((e) => e.wonTieBreaker)).toBe(false);
  });

  it("ends as a shared win when a tied vote leaves nobody to vote on a new prompt", () => {
    const t = toTieBreaker(topTwo);
    for (const id of contenders(t)) submit(t, id);
    t.act("p3", "CAST_VOTE", { answerId: answerBy(t, "p1") });
    t.act("p4", "CAST_VOTE", { answerId: answerBy(t, "p2") });
    expect(t.phase).toBe("TieBreakerReveal");
    t.drop("p3");
    t.drop("p4");
    t.tick(5000);
    expect(t.phase).toBe("Results");
    expect(t.priv.tieBreakerWinnerId).toBe("");
    expect(t.state.tieBreakers).toHaveLength(1);
  });

  it("treats a tie with no votes as still level", () => {
    const t = toTieBreaker(topTwo);
    for (const id of contenders(t)) submit(t, id);
    t.tick(20_000);
    expect(t.phase).toBe("TieBreakerReveal");
    t.tick(5000);
    expect(t.phase).toBe("TieBreakerPrompting");
  });
});

describe("contenders who leave", () => {
  it("hands the win to the last one standing while answering", () => {
    const t = toTieBreaker(topTwo);
    t.leave("p1");
    expect(t.phase).toBe("Results");
    expect(t.priv.tieBreakerWinnerId).toBe("p2");
    expect(t.priv.scores.p2).toBe(501);
    expect(t.state.scoreboard.find((e) => e.playerId === "p2")?.wonTieBreaker).toBe(true);
  });

  it("ends as a shared win when every voter leaves while answering", () => {
    const t = toTieBreaker(topTwo);
    submit(t, "p1");
    t.drop("p3");
    expect(t.phase).toBe("TieBreakerPrompting");
    t.drop("p4");
    expect(t.phase).toBe("Results");
    expect(t.priv.tieBreakerWinnerId).toBe("");
    expect(t.priv.scores.p1).toBe(500);
    expect(t.state.scoreboard.some((e) => e.wonTieBreaker)).toBe(false);
  });

  it("carries on with the rest when two or more remain", () => {
    const t = toTieBreaker(fourTied, fiveSeats);
    t.leave("p4");
    expect(t.phase).toBe("TieBreakerPrompting");
    expect(contenders(t)).toEqual(["p1", "p2", "p3"]);
    expect(t.state.progress.has("p4")).toBe(false);
    for (const id of ["p1", "p2"]) submit(t, id);
    expect(t.phase).toBe("TieBreakerPrompting");
    submit(t, "p3");
    expect(t.phase).toBe("TieBreakerVoting");
  });

  it("finishes answering when the leaver was the last one awaited", () => {
    const t = toTieBreaker(fourTied, fiveSeats);
    for (const id of ["p1", "p2"]) submit(t, id);
    t.leave("p3");
    t.leave("p4");
    expect(t.phase).toBe("TieBreakerVoting");
  });

  it("ends the vote with the contender who remains", () => {
    const t = toTieBreaker(topTwo);
    for (const id of contenders(t)) submit(t, id);
    t.leave("p2");
    expect(t.phase).toBe("Results");
    expect(t.priv.tieBreakerWinnerId).toBe("p1");
  });

  it("drops a contender who leaves during the reveal and plays on with the rest", () => {
    const t = toTieBreaker(fourTied, fiveSeats);
    for (const id of contenders(t)) submit(t, id);
    t.tick(20_000);
    expect(t.phase).toBe("TieBreakerReveal");
    t.leave("p1");
    t.tick(5000);
    expect(t.phase).toBe("TieBreakerPrompting");
    expect(contenders(t).sort()).toEqual(["p2", "p3", "p4"]);
  });

  it("awards the remaining contender when only one is left for the next prompt", () => {
    const t = toTieBreaker(topTwo);
    for (const id of contenders(t)) submit(t, id);
    t.act("p3", "CAST_VOTE", { answerId: answerBy(t, "p1") });
    t.act("p4", "CAST_VOTE", { answerId: answerBy(t, "p2") });
    t.leave("p1");
    t.tick(5000);
    expect(t.phase).toBe("Results");
    expect(t.priv.tieBreakerWinnerId).toBe("p2");
  });

  it("ends with no winner when every contender left before the next prompt", () => {
    const t = toTieBreaker(topTwo, { players: 6 });
    for (const id of contenders(t)) submit(t, id);
    t.act("p3", "CAST_VOTE", { answerId: answerBy(t, "p1") });
    t.act("p4", "CAST_VOTE", { answerId: answerBy(t, "p2") });
    t.act("p5", "CAST_VOTE", { answerId: answerBy(t, "p1") });
    t.act("p6", "CAST_VOTE", { answerId: answerBy(t, "p2") });
    t.leave("p1");
    t.leave("p2");
    t.tick(5000);
    expect(t.phase).toBe("Results");
    expect(t.priv.tieBreakerWinnerId).toBe("");
  });
});

describe("PLAY_AGAIN after a tie-breaker", () => {
  it("clears the tie-breaker", () => {
    const t = toTieBreaker(topTwo);
    submit(t, "p1");
    t.tick(90_000);
    t.tick(5000);
    expect(t.phase).toBe("Results");
    expect(t.state.tieBreakers).toHaveLength(1);
    t.act("p1", "PLAY_AGAIN");
    expect(t.state.tieBreakers).toHaveLength(0);
    expect(t.state.tieBreakerContenders).toHaveLength(0);
    expect(t.priv.tieBreakerWinnerId).toBe("");
    expect(t.priv.usedPromptIds.size).toBe(0);
  });
});

describe("the game falls below the minimum during the tie-breaker", () => {
  const tooFew = (t: Table): void => {
    expect(t.phase).toBe("Lobby");
    expect(t.state.notice).toContain("Fewer than 3 players");
    expect(t.state.tieBreakers).toHaveLength(0);
  };

  it("returns to the lobby while the contenders answer", () => {
    const t = toTieBreaker(topTwo);
    t.leave("p3");
    expect(t.phase).toBe("TieBreakerPrompting");
    t.leave("p4");
    tooFew(t);
  });

  it("returns to the lobby while the others vote", () => {
    const t = toTieBreaker(topTwo);
    for (const id of contenders(t)) submit(t, id);
    expect(t.phase).toBe("TieBreakerVoting");
    t.leave("p3");
    t.leave("p4");
    tooFew(t);
  });

  it("returns to the lobby during the reveal", () => {
    const t = toTieBreaker(topTwo);
    for (const id of contenders(t)) submit(t, id);
    t.act("p3", "CAST_VOTE", { answerId: answerBy(t, "p1") });
    t.act("p4", "CAST_VOTE", { answerId: answerBy(t, "p1") });
    expect(t.phase).toBe("TieBreakerReveal");
    t.leave("p3");
    expect(t.phase).toBe("TieBreakerReveal");
    t.leave("p4");
    tooFew(t);
  });
});

describe("END_GAME during the tie-breaker", () => {
  it.each(["TieBreakerPrompting", "TieBreakerVoting", "TieBreakerReveal"])(
    "returns the room to the lobby from %s",
    (phase) => {
      const t = toTieBreaker(topTwo);
      if (phase !== "TieBreakerPrompting") for (const id of contenders(t)) submit(t, id);
      if (phase === "TieBreakerReveal") t.tick(20_000);
      expect(t.phase).toBe(phase);
      t.act("p1", "END_GAME");
      expect(t.phase).toBe("Lobby");
    },
  );
});

describe("a leaver at the top of the standings", () => {
  it("does not stop a tie among the seated leaders and is ranked below them", () => {
    const t = new Table(finalRound({ players: 5 }));
    t.toVoting();
    t.leave("p4");
    for (;;) {
      if (t.phase === "MatchupVoting") t.voteFor(nth(t.authors(), 0));
      else if (t.phase === "MatchupReveal") {
        if (t.state.activeMatchupIndex + 1 === t.state.matchups.length)
          t.priv.scores = { p1: 500, p2: 500, p3: 100, p4: 900, p5: 100 };
        t.tick(5000);
      } else break;
    }
    expect(t.phase).toBe("TieBreakerPrompting");
    expect([...t.state.tieBreakerContenders]).toEqual(["p1", "p2"]);
  });

  it("lists the leaver below every seated player in the final scoreboard", () => {
    const t = new Table(finalRound());
    t.toVoting();
    t.priv.scores = { p1: 100, p2: 50, p3: 50, p4: 900 };
    t.leave("p4");
    t.playOutVoting();
    const rows = [...t.state.scoreboard];
    expect(rows[rows.length - 1]).toMatchObject({ playerId: "p4", hasLeft: true });
    expect(rows.slice(0, -1).every((r) => !r.hasLeft)).toBe(true);
  });
});
