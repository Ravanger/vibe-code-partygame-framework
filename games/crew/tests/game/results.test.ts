import { describe, expect, it } from "vitest";
import { playToVerdict, Table } from "./support.js";

describe("Results", () => {
  it("lets the host play again from a clean slate", () => {
    const t = Table.started({ options: { rounds: 1 } });
    playToVerdict(t);
    t.guess("p1", t.priv.target);
    expect(t.phase).toBe("Results");
    expect(t.act("p1", "PLAY_AGAIN")).toBeUndefined();
    expect(t.phase).toBe("Lobby");
    expect(t.state.round).toBe(0);
    expect(t.state.totalRounds).toBe(1);
    expect(t.state.roles.size).toBe(0);
    expect(t.state.reveals.length).toBe(0);
    expect(t.state.choices.length).toBe(0);
    expect(t.state.guesses.length).toBe(0);
    expect(t.state.outcome).toBe("");
    expect(t.state.target).toBe(0);
    expect(t.state.mine.size).toBe(0);
    expect(t.priv.signals).toEqual({});
  });

  it("deals fresh private data for the next game", () => {
    const t = Table.started({ options: { rounds: 1 } });
    playToVerdict(t);
    t.guess("p1", t.priv.target);
    t.act("p1", "PLAY_AGAIN");
    t.start();
    expect(t.phase).toBe("Round");
    expect(t.state.round).toBe(1);
    expect(t.state.roles.size).toBe(4);
    expect(t.state.mine.size).toBe(4);
    for (const playerId of t.ids()) {
      const signal = t.state.mine.get(playerId)?.signal;
      expect(signal).toBeGreaterThanOrEqual(1);
      expect(signal).toBeLessThanOrEqual(9);
    }
  });

  it("rejects PLAY_AGAIN from a non-host", () => {
    const t = Table.started({ options: { rounds: 1 } });
    playToVerdict(t);
    t.guess("p1", t.priv.target);
    const error = t.act("p2", "PLAY_AGAIN");
    expect(error?.code).toBe("UNAUTHORIZED");
    expect(t.phase).toBe("Results");
  });
});
