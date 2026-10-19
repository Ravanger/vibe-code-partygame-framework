import { describe, expect, it } from "vitest";
import { Table } from "./support.js";

describe("deterministic dealing", () => {
  it("deals identical roles and signals for the same seed", () => {
    const a = Table.started({ seed: 42, players: 5 });
    const b = Table.started({ seed: 42, players: 5 });
    expect([...a.state.roles]).toEqual([...b.state.roles]);
    expect(a.priv.signals).toEqual(b.priv.signals);
    expect(a.priv.target).toBe(b.priv.target);
  });

  it("deals the full role set to five players within signal range", () => {
    const t = Table.started({ seed: 7, players: 5 });
    expect([...t.state.roles.values()].sort()).toEqual([
      "Captain",
      "Comms",
      "Engineer",
      "Medic",
      "Navigator",
    ]);
    for (const signal of Object.values(t.priv.signals)) {
      expect(signal).toBeGreaterThanOrEqual(1);
      expect(signal).toBeLessThanOrEqual(9);
    }
  });
});
