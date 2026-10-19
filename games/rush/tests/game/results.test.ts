import { describe, expect, it } from "vitest";
import { Table } from "./support.js";

describe("Results", () => {
  it("lists every player by hits, ties broken by name", () => {
    const t = Table.started({ options: { raceSeconds: 5 } });
    t.state.hits.set("p1", 5);
    t.state.hits.set("p2", 9);
    t.state.hits.set("p3", 5);
    t.tick(5000);
    expect(t.phase).toBe("Results");
    expect(t.state.entries.map((e) => [e.playerId, e.name, e.hits])).toEqual([
      ["p2", "p2", 9],
      ["p1", "p1", 5],
      ["p3", "p3", 5],
      ["p4", "p4", 0],
    ]);
  });

  it("lets the host play again from a clean lobby", () => {
    const t = Table.started({ options: { raceSeconds: 5 } });
    t.tap("p1");
    t.tick(5000);
    expect(t.act("p1", "PLAY_AGAIN")).toBeUndefined();
    expect(t.phase).toBe("Lobby");
    expect(t.state.entries.length).toBe(0);
    expect(t.state.taps.size).toBe(0);
    expect(t.state.hits.size).toBe(0);
  });

  it("refuses PLAY_AGAIN from a non-host", () => {
    const t = Table.started({ options: { raceSeconds: 5 } });
    t.tick(5000);
    const error = t.act("p2", "PLAY_AGAIN");
    expect(error?.code).toBe("UNAUTHORIZED");
  });
});
