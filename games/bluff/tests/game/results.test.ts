import { describe, expect, it } from "vitest";
import { Table } from "./support.js";

const indexOf = (t: Table, text: string): number =>
  t.state.choices.findIndex((o) => o.text === text);

/** Plays the single configured round to the Results screen. */
const playToResults = (t: Table): void => {
  t.submitFake("p1", "Sydney");
  t.submitFake("p2", "Perth");
  t.submitFake("p3", "Brisbane");
  t.submitFake("p4", "Adelaide");
  t.voteFor("p1", indexOf(t, "Canberra"));
  t.voteFor("p2", indexOf(t, "Brisbane"));
  t.voteFor("p3", indexOf(t, "Sydney"));
  t.voteFor("p4", indexOf(t, "Perth"));
  t.tick(15_000);
};

describe("Results", () => {
  it("writes the final scoreboard with remembered names", () => {
    const t = Table.started({ options: { rounds: 1 } });
    playToResults(t);
    expect(t.phase).toBe("Results");
    expect(t.state.scoreboard.map((s) => [s.playerId, s.name, s.score])).toEqual([
      ["p1", "p1", 3],
      ["p2", "p2", 1],
      ["p3", "p3", 1],
      ["p4", "p4", 0],
    ]);
    for (const entry of t.state.scoreboard) expect(entry.hasLeft).toBe(false);
  });

  it("lets the host play again from a clean slate", () => {
    const t = Table.started({ options: { rounds: 1 } });
    playToResults(t);
    expect(t.act("p1", "PLAY_AGAIN")).toBeUndefined();
    expect(t.phase).toBe("Lobby");
    expect(t.state.roundNumber).toBe(0);
    expect(t.state.totalRounds).toBe(1);
    expect(t.state.promptText).toBe("");
    expect(t.state.choices.length).toBe(0);
    expect(t.state.results.length).toBe(0);
    expect(t.state.scoreboard.length).toBe(0);
    expect(t.priv.scores).toEqual({});
    expect(t.priv.usedPromptIds.size).toBe(0);
  });

  it("draws the first prompt again for the next game", () => {
    const t = Table.started({ options: { rounds: 1 } });
    playToResults(t);
    t.act("p1", "PLAY_AGAIN");
    t.start();
    expect(t.state.promptText).toBe("What is the capital of Australia?");
  });

  it("rejects PLAY_AGAIN from a non-host", () => {
    const t = Table.started({ options: { rounds: 1 } });
    playToResults(t);
    const error = t.act("p2", "PLAY_AGAIN");
    expect(error?.code).toBe("UNAUTHORIZED");
    expect(t.phase).toBe("Results");
  });
});
