import { describe, expect, it } from "vitest";
import { Table } from "./support.js";

describe("Waving", () => {
  it("starts with an empty board and no winner", () => {
    const t = new Table();
    t.start();
    expect(t.phase).toBe("Waving");
    expect(t.state.waves.size).toBe(0);
    expect(t.state.winnerName).toBe("");
    expect(t.state.winnerWaves).toBe(0);
  });

  it("counts a wave for the player who sent it", () => {
    const t = new Table();
    t.start();
    t.wave("p1");
    t.wave("p1");
    t.wave("p2");
    expect(t.state.waves.get("p1")).toBe(2);
    expect(t.state.waves.get("p2")).toBe(1);
    expect(t.phase).toBe("Waving");
  });

  it("moves to Results the moment a player reaches the goal", () => {
    const t = new Table({ options: { waveGoal: 3 } });
    t.start();
    t.wave("p2");
    t.wave("p2");
    expect(t.phase).toBe("Waving");
    t.wave("p2");
    expect(t.phase).toBe("Results");
  });

  it("lets the host end the wave early with FINISH", () => {
    const t = new Table();
    t.start();
    t.wave("p1");
    t.act("p1", "FINISH");
    expect(t.phase).toBe("Results");
  });

  it("refuses FINISH from a non-host", () => {
    const t = new Table();
    t.start();
    t.act("p2", "FINISH");
    expect(t.errors("p2")).toMatchObject([{ code: "UNAUTHORIZED" }]);
    expect(t.phase).toBe("Waving");
  });
});
