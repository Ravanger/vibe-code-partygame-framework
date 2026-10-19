import { describe, expect, it } from "vitest";
import { Table } from "./support.js";

describe("deterministic motion", () => {
  it("follows the same target path for the same seed", () => {
    const a = Table.started({ seed: 7, options: { raceSeconds: 5 } });
    const b = Table.started({ seed: 7, options: { raceSeconds: 5 } });
    for (let i = 0; i < 4; ++i) {
      expect([a.state.targetX, a.state.targetY]).toEqual([b.state.targetX, b.state.targetY]);
      a.tick(137);
      b.tick(137);
    }
    expect([a.priv.vx, a.priv.vy]).toEqual([b.priv.vx, b.priv.vy]);
  });

  it("follows different paths for different seeds", () => {
    const a = Table.started({ seed: 7, options: { raceSeconds: 5 } });
    const b = Table.started({ seed: 8, options: { raceSeconds: 5 } });
    a.tick(1000);
    b.tick(1000);
    expect([a.state.targetX, a.state.targetY]).not.toEqual([b.state.targetX, b.state.targetY]);
  });

  it("follows the recorded literal path for the default seed", () => {
    const t = Table.started(); // seed 1234, raceSeconds 10: deals (5.9128…, 3.0260…) at (-2, +2) cells/s
    expect([t.state.targetX, t.state.targetY]).toEqual([5.91285778908059, 3.026065519079566]);
    t.tick(500);
    expect([t.state.targetX, t.state.targetY]).toEqual([4.912857789080589, 4.026065519079567]);
    t.tick(1500);
    expect([t.state.targetX, t.state.targetY]).toEqual([1.9128577890805867, 7.0260655190795696]);
  });
});
