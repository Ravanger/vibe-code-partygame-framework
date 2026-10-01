import { describe, expect, it } from "vitest";
import { Table, type TableConfig } from "./support.js";

const inResults = (config: TableConfig = {}) => {
  const t = new Table(config);
  t.toResults();
  return t;
};

const row = (t: Table, id: string) => [...t.state.scoreboard].find((e) => e.playerId === id);

describe("scoring a matchup", () => {
  it("pays 100 per vote plus the winner bonus, and CLASH for a clean sweep", () => {
    const t = new Table();
    t.toVoting();
    const [winner] = t.authors() as [string];
    t.voteFor(winner);
    expect(t.priv.scores[winner]).toBe(2 * 100 + 50 + 150);
    expect(t.priv.roundAwards.filter((a) => a.isClash)).toHaveLength(1);
  });

  it("splits the votes without a bonus on a tie", () => {
    const t = new Table();
    t.toVoting();
    const [a, b] = t.authors() as [string, string];
    const [first, second] = t.eligible() as [string, string];
    t.act(first, "CAST_VOTE", { answerId: t.answerBy(a) });
    t.act(second, "CAST_VOTE", { answerId: t.answerBy(b) });
    expect(t.priv.scores).toEqual({ [a]: 100, [b]: 100 });
  });

  it("never awards CLASH when each matchup has a single eligible voter", () => {
    const t = new Table({ players: 3 });
    t.toVoting();
    const [winner] = t.authors() as [string];
    t.voteFor(winner);
    expect(t.priv.scores[winner]).toBe(100 + 50);
    expect(t.priv.roundAwards.some((a) => a.isClash)).toBe(false);
  });

  it("ignores votes from players who left before the reveal", () => {
    const t = new Table();
    t.toVoting();
    const [winner] = t.authors() as [string];
    const [first, second] = t.eligible() as [string, string];
    t.act(first, "CAST_VOTE", { answerId: t.answerBy(winner) });
    t.leave(second);
    expect(t.matchup().answers.find((a) => a.id === t.answerBy(winner))?.votes).toBe(1);
    expect(t.priv.scores[winner]).toBe(100 + 50);
  });

  it("gives the sole real answer of a forfeit the winner bonus and nothing else", () => {
    const t = new Table();
    t.toPrompting();
    t.act("p1", "SUBMIT_ANSWER", {
      matchupId: t.mine("p1").prompts[0]?.matchupId,
      answer: "alone",
    });
    t.tick(90_000);
    expect(t.matchup().isForfeit).toBe(true);
    expect(t.matchup().isRevealed).toBe(true);
    expect(t.priv.scores).toEqual({ p1: 50 });
    expect(t.priv.roundAwards).toMatchObject([
      { playerId: "p1", total: 50, isWinner: true, isClash: false },
    ]);
    expect(t.matchup().answers.find((a) => a.text === "alone")?.authorId).toBe("p1");
  });

  it("does not score placeholders", () => {
    const t = new Table();
    t.toPrompting();
    t.act("p1", "SUBMIT_ANSWER", {
      matchupId: t.mine("p1").prompts[0]?.matchupId,
      answer: "alone",
    });
    t.tick(90_000);
    expect(Object.keys(t.priv.scores)).toEqual(["p1"]);
  });
});

describe("Results", () => {
  it("lists every active player, including those on zero points", () => {
    const t = inResults({ options: { totalRounds: 1 } });
    expect(t.phase).toBe("Results");
    expect(t.state.scoreboard).toHaveLength(4);
    expect([...t.state.scoreboard].some((e) => e.score === 0)).toBe(true);
    expect([...t.state.scoreboard].map((e) => e.score)).toEqual(
      [...t.state.scoreboard].map((e) => e.score).sort((a, b) => b - a),
    );
  });

  it("fills roundPoints, matchupsWon and hadClash", () => {
    const t = inResults();
    const winners = [...t.state.scoreboard].filter((e) => e.matchupsWon > 0);
    expect(winners.length).toBeGreaterThan(0);
    for (const e of t.state.scoreboard) {
      expect(e.roundPoints).toBe(e.score);
      expect(e.name).toBe(e.playerId);
      expect(e.hasLeft).toBe(false);
    }
    expect([...t.state.scoreboard].some((e) => e.hadClash)).toBe(true);
  });

  it("flags the final round from the options", () => {
    expect(inResults({ options: { totalRounds: 1 } }).state.isFinalRound).toBe(true);
    expect(inResults({ options: { totalRounds: 2 } }).state.isFinalRound).toBe(false);
  });

  it("keeps a departed player's name and score, marked as left", () => {
    const t = inResults();
    const before = row(t, "p4")?.score;
    t.leave("p4");
    expect(row(t, "p4")).toMatchObject({ name: "p4", score: before, hasLeft: true });
    expect(t.state.scoreboard).toHaveLength(4);
  });

  it("keeps a player who left on zero points, below every seated player", () => {
    const t = inResults({ players: 6 });
    t.priv.scores = { p1: 10, p2: 20, p3: 30, p5: 5, p6: 1 };
    t.leave("p4");
    t.leave("p3");
    expect([...t.state.scoreboard].map((e) => [e.playerId, e.hasLeft])).toEqual([
      ["p2", false],
      ["p1", false],
      ["p5", false],
      ["p6", false],
      ["p3", true],
      ["p4", true],
    ]);
    expect(row(t, "p4")).toMatchObject({ name: "p4", score: 0, hasLeft: true });
  });

  it("keeps roundPoints when a player drops and rejoins", () => {
    const t = inResults();
    const before = JSON.stringify(t.state.scoreboard.toJSON());
    t.drop("p2");
    t.rejoin("p2");
    expect(JSON.stringify(t.state.scoreboard.toJSON())).toBe(before);
  });

  it("leaves a mid-game joiner off the scoreboard", () => {
    const t = inResults();
    t.joinLate("p9");
    expect(row(t, "p9")).toBeUndefined();
  });
});

describe("NEXT_ROUND", () => {
  it("starts a fresh category vote for the next round", () => {
    const t = inResults();
    t.act("p1", "NEXT_ROUND");
    expect(t.phase).toBe("CategorySelection");
    expect(t.state.roundNumber).toBe(2);
    expect(t.state.categoryOptions).toHaveLength(3);
    expect(t.state.categoryOptions.every((o) => o.votes === 0)).toBe(true);
    expect(t.state.matchups).toHaveLength(0);
    expect(t.state.scoreboard).toHaveLength(0);
    expect(t.state.selectedCategory).toBe("");
    expect(t.state.isFinalRound).toBe(false);
    expect(t.mine("p1").categoryVote).toBe("");
    expect(t.priv.roundAwards).toEqual([]);
  });

  it("carries scores into the next round and resets roundPoints", () => {
    const t = inResults();
    const before = { ...t.priv.scores };
    t.act("p1", "NEXT_ROUND");
    t.voteFirstCategory();
    t.answerEverything();
    t.playOutVoting();
    expect(t.phase).toBe("Results");
    expect(t.state.roundNumber).toBe(2);
    for (const e of t.state.scoreboard)
      expect(e.score).toBe((before[e.playerId] ?? 0) + e.roundPoints);
  });

  it("is host-only", () => {
    const t = inResults();
    t.act("p2", "NEXT_ROUND");
    expect(t.errors("p2")).toMatchObject([{ code: "UNAUTHORIZED" }]);
    expect(t.phase).toBe("Results");
  });

  it("is refused after the final round", () => {
    const t = inResults({ options: { totalRounds: 1 } });
    t.act("p1", "NEXT_ROUND");
    expect(t.errors("p1")).toMatchObject([{ code: "NOT_ALLOWED" }]);
    expect(t.phase).toBe("Results");
  });

  it("activates a mid-game joiner, who then plays the next round", () => {
    const t = inResults();
    t.joinLate("p9");
    t.act("p1", "NEXT_ROUND");
    expect(t.state.mine.has("p9")).toBe(true);
    t.voteFirstCategory();
    t.voteFirstCategory();
    t.act("p9", "VOTE_CATEGORY", { categoryId: t.state.categoryOptions[0]?.id });
    expect(t.phase).toBe("Prompting");
    expect(t.state.matchups).toHaveLength(5);
    expect(t.mine("p9").prompts).toHaveLength(2);
  });
});

describe("PLAY_AGAIN", () => {
  it("returns to the lobby with everything reset", () => {
    const t = inResults({ options: { totalRounds: 1 } });
    t.act("p1", "PLAY_AGAIN");
    expect(t.phase).toBe("Lobby");
    expect(t.state.roundNumber).toBe(0);
    expect(t.state.isFinalRound).toBe(false);
    expect(t.state.scoreboard).toHaveLength(0);
    expect(t.state.matchups).toHaveLength(0);
    expect(t.state.categoryOptions).toHaveLength(0);
    expect(t.state.mine.size).toBe(0);
    expect(t.state.progress.size).toBe(0);
    expect(t.state.activeMatchupIndex).toBe(-1);
    expect(t.priv.scores).toEqual({});
    expect(t.priv.names).toEqual({});
    expect(t.state.totalRounds).toBe(1);
    expect(t.host.views.filter((v) => v.op === "hide").length).toBe(4);
  });

  it("is host-only", () => {
    const t = inResults();
    t.act("p3", "PLAY_AGAIN");
    expect(t.errors("p3")).toMatchObject([{ code: "UNAUTHORIZED" }]);
    expect(t.phase).toBe("Results");
  });

  it("lets a mid-game joiner into the next game", () => {
    const t = inResults({ options: { totalRounds: 1 } });
    t.joinLate("p9");
    t.act("p1", "PLAY_AGAIN");
    expect(t.host.seats.find((s) => s.id === "p9")?.isActive).toBe(true);
    t.act("p1", "START_GAME");
    expect(t.phase).toBe("CategorySelection");
    expect(t.state.mine.has("p9")).toBe(true);
  });

  it("lets the same players play another full game", () => {
    const t = inResults({ options: { totalRounds: 1 } });
    t.act("p1", "PLAY_AGAIN");
    t.act("p1", "START_GAME");
    expect(t.phase).toBe("CategorySelection");
    expect(t.state.roundNumber).toBe(1);
  });
});
