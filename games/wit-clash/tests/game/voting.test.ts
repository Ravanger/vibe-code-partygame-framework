import { describe, expect, it } from "vitest";
import { Table, type TableConfig } from "./support.js";

const inVoting = (config: TableConfig = {}) => {
  const t = new Table(config);
  t.toVoting();
  return t;
};

const nonAuthors = (t: Table) => t.ids().filter((id) => !t.authors().includes(id));

describe("entering MatchupVoting", () => {
  it("starts on the first matchup with a vote deadline", () => {
    const t = inVoting();
    expect(t.phase).toBe("MatchupVoting");
    expect(t.state.activeMatchupIndex).toBe(0);
    expect(t.state.phaseEndsAt - t.host.time).toBe(20_000);
  });

  it("keeps every author hidden and every tally at zero", () => {
    const t = inVoting();
    for (const a of t.matchup().answers) {
      expect(a.authorId).toBe("");
      expect(a.votes).toBe(0);
    }
    expect(t.matchup().isRevealed).toBe(false);
  });

  it("publishes how many may vote and tells each player their own eligibility", () => {
    const t = inVoting();
    expect(t.state.votesExpected).toBe(2);
    expect(t.state.votesCast).toBe(0);
    for (const id of t.ids()) {
      const isAuthor = t.authors().includes(id);
      expect(t.mine(id).isOwnMatchup).toBe(isAuthor);
      expect(t.mine(id).canVote).toBe(!isAuthor);
    }
  });

  it("uses the vote option for the deadline", () => {
    const t = inVoting({ options: { voteSeconds: 40 } });
    expect(t.state.phaseEndsAt - t.host.time).toBe(40_000);
  });
});

describe("CAST_VOTE", () => {
  it("records the vote privately and only counts it publicly", () => {
    const t = inVoting();
    const [voter] = nonAuthors(t) as [string];
    const answerId = t.answerBy(t.authors()[0] as string);
    t.act(voter, "CAST_VOTE", { answerId });
    expect(t.state.votesCast).toBe(1);
    expect(t.mine(voter).matchupVote).toBe(answerId);
    for (const id of t.ids().filter((x) => x !== voter)) expect(t.mine(id).matchupVote).toBe("");
    expect(t.matchup().answers.every((a) => a.votes === 0)).toBe(true);
    expect(t.phase).toBe("MatchupVoting");
  });

  it("rejects a vote from an author of the matchup", () => {
    const t = inVoting();
    const author = t.authors()[0] as string;
    t.act(author, "CAST_VOTE", { answerId: t.answerBy(t.authors()[1] as string) });
    expect(t.errors(author)).toMatchObject([{ code: "NOT_ALLOWED" }]);
    expect(t.state.votesCast).toBe(0);
  });

  it("rejects an answer from another matchup and an unknown answer", () => {
    const t = inVoting();
    const [voter] = nonAuthors(t) as [string];
    const other = t.state.matchups[1]?.answers[0]?.id;
    t.act(voter, "CAST_VOTE", { answerId: other });
    t.act(voter, "CAST_VOTE", { answerId: "nope" });
    expect(t.errors(voter)).toMatchObject([{ code: "INVALID_ACTION" }, { code: "INVALID_ACTION" }]);
    expect(t.state.votesCast).toBe(0);
  });

  it("cannot be used to vote for the placeholder of a forfeit", () => {
    const t = new Table();
    t.toPrompting();
    t.act("p1", "SUBMIT_ANSWER", { matchupId: t.mine("p1").prompts[0]?.matchupId, answer: "real" });
    t.tick(90_000);
    expect(t.state.activeMatchupIndex).toBe(0);
    const placeholder = [...t.matchup().answers].find((a) => a.text === "(no answer)");
    const voter = t.ids()[1] as string;
    t.act(voter, "CAST_VOTE", { answerId: placeholder?.id });
    expect(t.errors(voter)).toMatchObject([{ code: "WRONG_PHASE" }]);
  });

  it("lets a voter change their mind without double counting", () => {
    const t = inVoting();
    const [voter, other] = nonAuthors(t) as [string, string];
    const [a, b] = t.authors() as [string, string];
    t.act(voter, "CAST_VOTE", { answerId: t.answerBy(a) });
    t.act(voter, "CAST_VOTE", { answerId: t.answerBy(b) });
    expect(t.state.votesCast).toBe(1);
    expect(t.mine(voter).matchupVote).toBe(t.answerBy(b));
    t.act(other, "CAST_VOTE", { answerId: t.answerBy(b) });
    expect(t.phase).toBe("MatchupReveal");
    expect(t.matchup().answers.find((x) => x.id === t.answerBy(b))?.votes).toBe(2);
  });

  it("is rejected outside voting", () => {
    const t = new Table();
    t.start();
    t.act("p1", "CAST_VOTE", { answerId: "x" });
    expect(t.errors("p1")).toMatchObject([{ code: "WRONG_PHASE" }]);
  });
});

describe("revealing a matchup", () => {
  it("reveals as soon as every eligible voter has voted", () => {
    const t = inVoting();
    const [a] = t.authors() as [string];
    t.voteFor(a);
    expect(t.phase).toBe("MatchupReveal");
    expect(t.matchup().isRevealed).toBe(true);
    expect(
      t
        .matchup()
        .answers.map((x) => x.authorId)
        .sort(),
    ).toEqual([...t.authors()].sort());
    expect(t.state.phaseEndsAt - t.host.time).toBe(5000);
  });

  it("reveals at the deadline with whatever votes were cast", () => {
    const t = inVoting();
    const [voter] = nonAuthors(t) as [string];
    t.act(voter, "CAST_VOTE", { answerId: t.answerBy(t.authors()[0] as string) });
    t.tick(20_000);
    expect(t.phase).toBe("MatchupReveal");
    expect(
      t
        .matchup()
        .answers.map((x) => x.votes)
        .sort(),
    ).toEqual([0, 1]);
  });

  it("publishes who won and who wrote what, but only once revealed", () => {
    const t = inVoting();
    const [winnerId, loserId] = t.authors() as [string, string];
    expect(t.matchup().answers.every((a) => a.authorName === "" && !a.isWinner)).toBe(true);
    expect(t.matchup().isClash).toBe(false);
    t.voteFor(winnerId);
    const byAuthor = (id: string) => t.matchup().answers.find((a) => a.authorId === id);
    expect(byAuthor(winnerId)).toMatchObject({ authorName: winnerId, isWinner: true });
    expect(byAuthor(loserId)).toMatchObject({ authorName: loserId, isWinner: false });
    expect(t.matchup().isClash).toBe(true);
  });

  it("does not call a tie a win", () => {
    const t = inVoting({ players: 6 });
    const [first, second] = t.authors() as [string, string];
    const [a, b] = t.eligible() as [string, string];
    t.act(a, "CAST_VOTE", { answerId: t.answerBy(first) });
    t.act(b, "CAST_VOTE", { answerId: t.answerBy(second) });
    t.tick(20_000);
    expect(t.matchup().answers.some((x) => x.isWinner)).toBe(false);
    expect(t.matchup().isClash).toBe(false);
  });

  it("keeps the name of an author who left before the reveal", () => {
    const t = inVoting();
    const [leaver, other] = t.authors() as [string, string];
    t.leave(leaver);
    t.voteFor(other);
    const left = t.matchup().answers.find((a) => a.authorId === leaver);
    expect(left?.authorName).toBe(leaver);
  });

  it("fills authors for the revealed matchup only", () => {
    const t = inVoting();
    t.voteFor(t.authors()[0] as string);
    const later = [...t.state.matchups].slice(1).flatMap((m) => [...m.answers]);
    expect(later.every((a) => a.authorId === "" && a.votes === 0)).toBe(true);
  });

  it("moves to the next matchup after the reveal window, clearing the previous votes", () => {
    const t = inVoting();
    const [voter] = nonAuthors(t) as [string];
    t.voteFor(t.authors()[0] as string);
    t.tick(5000);
    expect(t.phase).toBe("MatchupVoting");
    expect(t.state.activeMatchupIndex).toBe(1);
    expect(t.state.votesCast).toBe(0);
    expect(t.mine(voter).matchupVote).toBe("");
    expect(t.matchup().isRevealed).toBe(false);
  });

  it("goes to Results after the last matchup", () => {
    const t = inVoting();
    t.playOutVoting();
    expect(t.phase).toBe("Results");
    expect(t.state.matchups.every((m) => m.isRevealed)).toBe(true);
  });

  it("uses the reveal option for the reveal window", () => {
    const t = inVoting({ options: { revealSeconds: 9 } });
    t.voteFor(t.authors()[0] as string);
    expect(t.state.phaseEndsAt - t.host.time).toBe(9000);
  });
});

describe("eligibility", () => {
  it("excludes a disconnected player from the expected votes", () => {
    const t = inVoting();
    const [voter, other] = nonAuthors(t) as [string, string];
    t.drop(other);
    expect(t.state.votesExpected).toBe(1);
    expect(t.mine(other).canVote).toBe(false);
    t.act(voter, "CAST_VOTE", { answerId: t.answerBy(t.authors()[0] as string) });
    expect(t.phase).toBe("MatchupReveal");
  });

  it("reveals at once when the last pending voter leaves", () => {
    const t = inVoting();
    const [voter, other] = nonAuthors(t) as [string, string];
    t.act(voter, "CAST_VOTE", { answerId: t.answerBy(t.authors()[0] as string) });
    expect(t.phase).toBe("MatchupVoting");
    t.leave(other);
    expect(t.phase).toBe("MatchupReveal");
    expect(t.state.mine.has(other)).toBe(false);
  });

  it("reveals when every eligible voter disconnects", () => {
    const t = inVoting();
    for (const id of nonAuthors(t)) t.drop(id);
    expect(t.phase).toBe("MatchupReveal");
  });

  it("keeps an author who reconnects from voting on their own matchup", () => {
    const t = inVoting();
    const author = t.authors()[0] as string;
    t.drop(author);
    t.rejoin(author);
    expect(t.mine(author).isOwnMatchup).toBe(true);
    t.act(author, "CAST_VOTE", { answerId: t.answerBy(t.authors()[1] as string) });
    expect(t.errors(author)).toMatchObject([{ code: "NOT_ALLOWED" }]);
  });

  it("restores a voter's choice and flags on reconnect", () => {
    const t = inVoting();
    const [voter] = nonAuthors(t) as [string];
    const answerId = t.answerBy(t.authors()[0] as string);
    t.act(voter, "CAST_VOTE", { answerId });
    t.drop(voter);
    expect(t.state.votesExpected).toBe(1);
    t.rejoin(voter);
    expect(t.state.votesExpected).toBe(2);
    expect(t.state.votesCast).toBe(1);
    expect(t.mine(voter).matchupVote).toBe(answerId);
    expect(t.mine(voter).canVote).toBe(true);
  });

  it("does not make a mid-game joiner eligible, and counts voters correctly", () => {
    const t = inVoting();
    t.joinLate("p9");
    expect(t.state.votesExpected).toBe(2);
    expect(t.state.mine.has("p9")).toBe(false);
    t.act("p9", "CAST_VOTE", { answerId: t.answerBy(t.authors()[0] as string) });
    expect(t.errors("p9")).toMatchObject([{ code: "NOT_ACTIVE" }]);
    expect(t.state.votesCast).toBe(0);
  });

  it("keeps a player who named themselves after the start out of the round, then lets them in", () => {
    const t = new Table({ players: 4, options: { totalRounds: 2 } });
    const late = t.host.seat("p9", { isReady: false });
    t.act("p1", "START_GAME");
    expect(late.isActive).toBe(false);
    t.voteFirstCategory();
    t.answerEverything();
    late.isReady = true;
    t.runtime.rosterChanged();
    expect(t.state.votesExpected).toBe(2);
    expect(t.mine("p9")).toBeUndefined();
    t.playOutVoting();
    t.act("p1", "NEXT_ROUND");
    expect(late.isActive).toBe(true);
    expect(t.mine("p9")).toBeDefined();
  });
});

describe("skipping votes that cannot happen", () => {
  it("reveals a matchup with no eligible voter immediately and awards nothing", () => {
    const t = new Table({ players: 3 });
    t.start();
    t.drop("p3");
    t.voteFirstCategory();
    t.answerEverything();
    expect(t.phase).toBe("MatchupReveal");
    expect(t.matchup().isRevealed).toBe(true);
    expect(t.priv.scores).toEqual({});
    t.tick(5000);
    expect(t.phase).toBe("Results");
  });

  it("goes straight to the reveal of a forfeit, whatever the player count", () => {
    const t = new Table();
    t.toPrompting();
    t.act("p1", "SUBMIT_ANSWER", {
      matchupId: t.mine("p1").prompts[0]?.matchupId,
      answer: "alone",
    });
    t.tick(90_000);
    expect(t.phase).toBe("MatchupReveal");
    expect(t.matchup().isForfeit).toBe(true);
    expect(t.matchup().answers.filter((a) => a.isWinner)).toHaveLength(1);
    expect(t.matchup().isClash).toBe(false);
    expect(t.state.votesExpected).toBe(0);
    expect(t.ids().every((id) => !t.mine(id).canVote)).toBe(true);
  });
});
