import { describe, expect, it } from "vitest";
import { Table } from "./support.js";

const MESSAGE = "Fewer than 3 players were left, so the game ended.";

describe("the minimum player count", () => {
  it("returns to the lobby with a notice when too few players are left in CategorySelection", () => {
    const t = new Table({ players: 3 });
    t.start();
    t.leave("p3");
    expect(t.phase).toBe("Lobby");
    expect(t.state.notice).toBe(MESSAGE);
    expect(t.state.roundNumber).toBe(0);
  });

  it.each([
    ["Prompting", (t: Table) => t.toPrompting()],
    ["MatchupVoting", (t: Table) => t.toVoting()],
    [
      "MatchupReveal",
      (t: Table) => {
        t.toVoting();
        t.voteFor(t.authors()[0] as string);
      },
    ],
  ])("returns to the lobby from %s", (phase, advance) => {
    const t = new Table({ players: 3 });
    advance(t);
    expect(t.phase).toBe(phase);
    t.leave("p3");
    expect(t.phase).toBe("Lobby");
    expect(t.state.notice).toBe(MESSAGE);
    expect(t.state.matchups).toHaveLength(0);
  });

  it("keeps the game going while a player is only disconnected", () => {
    const t = new Table({ players: 3 });
    t.toVoting();
    t.drop("p3");
    expect(t.phase).toBe("MatchupVoting");
    t.rejoin("p3");
    expect(t.state.notice).toBe("");
  });

  it("does not count a mid-game joiner who has no seat in the round yet", () => {
    const t = new Table({ players: 3 });
    t.toVoting();
    t.joinLate("p9");
    expect(t.phase).toBe("MatchupVoting");
    t.leave("p3");
    expect(t.phase).toBe("Lobby");
  });

  it("does not count a player who never chose a name", () => {
    const t = new Table({ players: 4 });
    t.toVoting();
    const unnamed = t.host.seats.find((s) => s.id === "p4");
    if (unnamed) unnamed.isReady = false;
    t.runtime.rosterChanged();
    expect(t.phase).toBe("MatchupVoting");
    t.leave("p3");
    expect(t.phase).toBe("Lobby");
  });

  it("leaves the final results up even when players have gone", () => {
    const t = new Table({ players: 4, options: { totalRounds: 1 } });
    t.toResults();
    t.leave("p3");
    t.leave("p4");
    expect(t.phase).toBe("Results");
    expect(t.state.notice).toBe("");
  });

  it("refuses the next round when too few players remain, and says so", () => {
    const t = new Table({ players: 4, options: { totalRounds: 2 } });
    t.toResults();
    t.leave("p3");
    t.leave("p4");
    expect(t.phase).toBe("Results");
    t.act("p1", "NEXT_ROUND");
    expect(t.phase).toBe("Lobby");
    expect(t.state.notice).toBe(MESSAGE);
  });

  it("clears the notice when a new game starts", () => {
    const t = new Table({ players: 3 });
    t.start();
    t.leave("p3");
    expect(t.state.notice).toBe(MESSAGE);
    t.host.seat("p4");
    t.runtime.rosterChanged();
    t.start();
    expect(t.phase).toBe("CategorySelection");
    expect(t.state.notice).toBe("");
  });
});

describe("END_GAME", () => {
  it.each([
    ["CategorySelection", (t: Table) => t.start()],
    ["Prompting", (t: Table) => t.toPrompting()],
    ["MatchupVoting", (t: Table) => t.toVoting()],
    [
      "MatchupReveal",
      (t: Table) => {
        t.toVoting();
        t.voteFor(t.authors()[0] as string);
      },
    ],
    ["Results", (t: Table) => t.toResults()],
  ])("lets the host return everyone to the lobby from %s", (phase, advance) => {
    const t = new Table();
    advance(t);
    expect(t.phase).toBe(phase);
    t.act("p1", "END_GAME");
    expect(t.phase).toBe("Lobby");
    expect(t.state.notice).toBe("The host ended the game.");
    expect(t.state.roundNumber).toBe(0);
    expect(t.state.matchups).toHaveLength(0);
  });

  it("is refused for a player who is not the host", () => {
    const t = new Table();
    t.toVoting();
    t.act("p2", "END_GAME");
    expect(t.phase).toBe("MatchupVoting");
    expect(t.errors("p2")).toMatchObject([{ code: "UNAUTHORIZED" }]);
  });
});
