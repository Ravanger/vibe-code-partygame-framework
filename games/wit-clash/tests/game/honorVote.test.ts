import { describe, expect, it } from "vitest";
import { Table } from "./support.js";

const honorTable = () => new Table({ options: { totalRounds: 1, honorVote: true } });

/** The unique authors of the best answers, in order — the candidates of the honor vote. */
const candidatesOf = (t: Table): string[] => {
  const ids: string[] = [];
  for (const answer of t.state.bestAnswers) {
    if (!ids.includes(answer.authorId)) ids.push(answer.authorId);
  }
  return ids;
};

describe("honor vote", () => {
  it("goes to HonorVote after the final round and back to Results with the winner", () => {
    const t = honorTable();
    t.toResults();
    expect(t.phase).toBe("HonorVote");
    const up = candidatesOf(t);
    expect(up.length).toBeGreaterThan(0);
    for (const id of t.ids()) {
      const target = id === up[0] ? (up[1] ?? undefined) : (up[0] as string);
      if (target !== undefined) t.act(id, "VOTE_HONOR", { authorId: target });
    }
    expect(t.phase).toBe("Results");
    expect([...t.state.honorWinnerNames]).toEqual([up[0]]);
    const honor = [...t.state.awards].find((a) => a.id === "honor");
    expect(honor?.title).toBe("Honor award");
    expect([...(honor?.winnerNames ?? [])]).toEqual([up[0]]);
    expect(honor?.detail).toBe("chosen by the players");
  });

  it("stays straight to Results when the option is off", () => {
    const t = new Table({ options: { totalRounds: 1 } });
    t.toResults();
    expect(t.phase).toBe("Results");
    expect([...t.state.honorWinnerNames]).toHaveLength(0);
  });

  it("refuses a vote for one's own answer and for an unknown candidate", () => {
    const t = honorTable();
    t.toResults();
    const up = candidatesOf(t);
    const me = up[0] as string;
    t.act(me, "VOTE_HONOR", { authorId: me });
    expect(t.errors(me)).toMatchObject([{ code: "NOT_ALLOWED" }]);
    t.act("p1", "VOTE_HONOR", { authorId: "nobody" });
    expect(t.errors("p1")).toMatchObject([{ code: "INVALID_ACTION" }]);
    expect(t.phase).toBe("HonorVote");
    expect(t.state.votesCast).toBe(0);
  });

  it("times out to Results with no winner when nobody votes", () => {
    const t = honorTable();
    t.toResults();
    expect(t.phase).toBe("HonorVote");
    t.tick(20_000);
    expect(t.phase).toBe("Results");
    expect([...t.state.honorWinnerNames]).toHaveLength(0);
    expect([...t.state.awards].some((a) => a.id === "honor")).toBe(false);
  });

  it("skips the honor vote when there are no best answers", () => {
    const t = honorTable();
    t.toPrompting();
    t.tick(90_000);
    expect(t.phase).toBe("Results");
    expect([...t.state.honorWinnerNames]).toHaveLength(0);
  });

  it("lets the table vote when one player is the only candidate", () => {
    const t = new Table({ players: 3, options: { totalRounds: 1, honorVote: true } });
    t.toPrompting();
    const first = t.mine("p1").prompts[0] as { matchupId: string };
    const partner = [...t.priv.assignments.entries()].find(
      ([id, ids]) => id !== "p1" && ids.includes(first.matchupId),
    ) as [string, string[]];
    t.act("p1", "SUBMIT_ANSWER", { matchupId: first.matchupId, answer: "the one" });
    t.act(partner[0], "SUBMIT_ANSWER", { matchupId: first.matchupId, answer: "the other" });
    t.tick(90_000);
    expect(t.phase).toBe("MatchupVoting");
    t.voteFor("p1");
    t.tick(5000);
    expect(t.phase).toBe("HonorVote");
    expect(candidatesOf(t)).toEqual(["p1"]);
    expect(t.state.votesExpected).toBe(2);
    for (const id of ["p2", "p3"]) t.act(id, "VOTE_HONOR", { authorId: "p1" });
    expect(t.phase).toBe("Results");
    expect([...t.state.honorWinnerNames]).toEqual(["p1"]);
  });

  it("drops a leaver from the voter count and keeps the remaining votes", () => {
    const t = honorTable();
    t.toResults();
    const up = candidatesOf(t);
    const voter = t.ids().find((id) => id !== (up[0] as string)) as string;
    expect(t.state.votesExpected).toBe(4);
    t.act(voter, "VOTE_HONOR", { authorId: up[0] as string });
    expect(t.state.votesCast).toBe(1);
    const leaver = t.ids().find((id) => id !== voter && id !== (up[0] as string)) as string;
    t.leave(leaver);
    expect(t.phase).toBe("HonorVote");
    expect(t.state.votesExpected).toBe(3);
    expect(t.state.votesCast).toBe(1);
  });

  it("ignores a disconnected voter until they rejoin", () => {
    const t = honorTable();
    t.toResults();
    const up = candidatesOf(t);
    const dropped = t.ids().find((id) => id !== (up[0] as string)) as string;
    const before = t.state.votesExpected;
    t.drop(dropped);
    expect(t.phase).toBe("HonorVote");
    expect(t.state.votesExpected).toBe(before - 1);
    t.rejoin(dropped);
    expect(t.state.votesExpected).toBe(before);
  });

  it("ignores a mid-game joiner who has no seat in the honor vote", () => {
    const t = honorTable();
    t.toResults();
    const before = t.state.votesExpected;
    t.joinLate("p9");
    expect(t.phase).toBe("HonorVote");
    expect(t.state.votesExpected).toBe(before);
  });

  it("ends the game when too few players remain mid-vote", () => {
    const t = honorTable();
    t.toResults();
    t.leave("p3");
    t.leave("p4");
    expect(t.phase).toBe("Lobby");
  });
});
