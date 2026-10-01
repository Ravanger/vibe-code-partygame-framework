import { describe, expect, it } from "vitest";
import { Table } from "./support.js";

describe("playtest regressions (token reconnect is covered in integration.reconnect.test.ts)", () => {
  it("START_GAME below minPlayers is refused with NOT_ENOUGH_PLAYERS", () => {
    const t = new Table({ players: 2 });
    t.act("p1", "START_GAME");
    expect(t.phase).toBe("Lobby");
    expect(t.errors("p1")).toMatchObject([{ code: "NOT_ENOUGH_PLAYERS", action: "START_GAME" }]);
  });

  it("a last pending voter leaving resolves the vote immediately", () => {
    const t = new Table();
    t.toVoting();
    const [first, last] = t.eligible() as [string, string];
    t.act(first, "CAST_VOTE", { answerId: t.answerBy(t.authors()[0] as string) });
    t.leave(last);
    expect(t.phase).toBe("MatchupReveal");
  });

  it("players on zero points are on the scoreboard", () => {
    const t = new Table();
    t.toPrompting();
    t.tick(90_000);
    expect(t.phase).toBe("Results");
    expect([...t.state.scoreboard].map((e) => [e.playerId, e.score])).toEqual([
      ["p1", 0],
      ["p2", 0],
      ["p3", 0],
      ["p4", 0],
    ]);
  });

  it("a player who rejoins keeps their roundPoints", () => {
    const t = new Table();
    t.toResults();
    const winner = [...t.state.scoreboard][0];
    expect(winner?.roundPoints).toBeGreaterThan(0);
    t.drop(winner?.playerId as string);
    t.rejoin(winner?.playerId as string);
    const after = [...t.state.scoreboard].find((e) => e.playerId === winner?.playerId);
    expect(after).toMatchObject({
      roundPoints: winner?.roundPoints,
      score: winner?.score,
      hasLeft: false,
    });
  });

  it("a mid-game joiner is not eligible and the eligible voter count stays right", () => {
    const t = new Table();
    t.toVoting();
    const before = t.state.votesExpected;
    t.joinLate("p9");
    expect(t.state.votesExpected).toBe(before);
    expect(t.state.mine.has("p9")).toBe(false);
    expect(t.eligible()).not.toContain("p9");
  });
});
