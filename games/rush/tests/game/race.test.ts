import { describe, expect, it } from "vitest";
import { GRID } from "../../src/target.js";
import { Table } from "./support.js";

describe("Race", () => {
  it("deals the target inside the grid and moves it on every tick", () => {
    const t = Table.started();
    expect(t.state.targetX).toBeGreaterThanOrEqual(0);
    expect(t.state.targetX).toBeLessThan(GRID);
    expect(t.state.targetY).toBeGreaterThanOrEqual(0);
    expect(t.state.targetY).toBeLessThan(GRID);
    for (let i = 0; i < 5; ++i) {
      const x = t.state.targetX;
      const y = t.state.targetY;
      t.tick(100);
      expect([t.state.targetX, t.state.targetY]).not.toEqual([x, y]);
      expect(t.state.targetX).toBeGreaterThanOrEqual(0);
      expect(t.state.targetX).toBeLessThanOrEqual(GRID);
      expect(t.state.targetY).toBeGreaterThanOrEqual(0);
      expect(t.state.targetY).toBeLessThanOrEqual(GRID);
    }
  });

  it("counts every TAP and scores a hit only while the target is in the center zone", () => {
    const t = Table.started();
    t.state.targetX = 0;
    t.state.targetY = 0;
    t.tap("p1");
    expect(t.state.taps.get("p1")).toBe(1);
    expect(t.state.hits.get("p1")).toBeUndefined();
    t.state.targetX = GRID / 2;
    t.state.targetY = GRID / 2;
    t.tap("p1");
    expect(t.state.taps.get("p1")).toBe(2);
    expect(t.state.hits.get("p1")).toBe(1);
    t.tap("p1");
    expect(t.state.hits.get("p1")).toBe(2);
    t.tap("p2");
    expect(t.state.taps.get("p2")).toBe(1);
    expect(t.state.hits.get("p2")).toBe(1);
  });

  it("ends the race in Results when the configured duration elapses", () => {
    const t = Table.started({ options: { raceSeconds: 5 } });
    t.tick(4999);
    expect(t.phase).toBe("Race");
    t.tick(1);
    expect(t.phase).toBe("Results");
  });

  it("keeps racing when a departure still leaves two or more players", () => {
    const t = Table.started({ players: 4 });
    t.leave("p4");
    expect(t.phase).toBe("Race");
  });

  it("ends the race in the lobby when a departure drops the room below two", () => {
    const t = Table.started({ players: 2 });
    t.leave("p2");
    expect(t.phase).toBe("Lobby");
    expect(t.state.notice).toBe("Fewer than 2 players were left, so the race ended.");
  });
});
