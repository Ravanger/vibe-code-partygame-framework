import { describe, expect, it } from "vitest";
import { Table } from "./support.js";

const inResults = (): Table => {
  const t = new Table();
  t.start();
  return t;
};

describe("Results", () => {
  it("names the player with the most waves", () => {
    const t = inResults();
    t.wave("p1");
    t.wave("p2");
    t.wave("p2");
    t.act("p1", "FINISH");
    expect(t.state.winnerName).toBe("p2");
    expect(t.state.winnerWaves).toBe(2);
  });

  it("breaks ties in favour of the earliest-seated player", () => {
    const t = inResults();
    t.wave("p2");
    t.wave("p3");
    t.act("p1", "FINISH");
    expect(t.state.winnerName).toBe("p2");
    expect(t.state.winnerWaves).toBe(1);
  });

  it("reports no winner when nobody waved", () => {
    const t = inResults();
    t.act("p1", "FINISH");
    expect(t.state.winnerName).toBe("");
    expect(t.state.winnerWaves).toBe(0);
  });

  it("ignores players who left before the result", () => {
    const t = inResults();
    t.wave("p2");
    t.leave("p2");
    t.act("p1", "FINISH");
    expect(t.state.winnerName).toBe("");
    expect(t.state.winnerWaves).toBe(0);
  });
});

describe("PLAY_AGAIN", () => {
  it("returns to the lobby", () => {
    const t = inResults();
    t.wave("p1");
    t.act("p1", "FINISH");
    t.act("p1", "PLAY_AGAIN");
    expect(t.phase).toBe("Lobby");
  });

  it("is host-only", () => {
    const t = inResults();
    t.act("p1", "FINISH");
    t.act("p2", "PLAY_AGAIN");
    expect(t.errors("p2")).toMatchObject([{ code: "UNAUTHORIZED" }]);
    expect(t.phase).toBe("Results");
  });

  it("starts a fresh board for the next game", () => {
    const t = inResults();
    t.wave("p1");
    t.act("p1", "FINISH");
    t.act("p1", "PLAY_AGAIN");
    t.act("p1", "START_GAME");
    expect(t.phase).toBe("Waving");
    expect(t.state.waves.size).toBe(0);
    expect(t.state.winnerName).toBe("");
    expect(t.state.winnerWaves).toBe(0);
  });
});
