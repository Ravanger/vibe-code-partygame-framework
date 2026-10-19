import { describe, expect, it } from "vitest";
import { playToVerdict, revealOf, Table } from "./support.js";

describe("departures", () => {
  it("reveals a leaver's signal publicly and drops their private entry", () => {
    const t = Table.started({ players: 4 });
    const signal = t.priv.signals["p3"];
    if (signal === undefined) throw new Error("expected p3 to have a signal");
    t.leave("p3");
    expect(t.state.mine.size).toBe(3);
    expect(t.state.roles.get("p3")).toBeUndefined();
    const entry = t.state.reveals.find((r) => r.playerId === "p3");
    expect(entry?.signal).toBe(signal);
    expect(entry?.name).toBe("p3");
  });

  it("reveals a leaver's signal with an empty remembered name", () => {
    const t = Table.started({ seats: [{}, {}, {}, { name: "" }] });
    t.leave("p4");
    const entry = t.state.reveals.find((r) => r.playerId === "p4");
    expect(entry?.name).toBe("");
  });

  it("keeps the target locked to the starting crew when someone leaves", () => {
    const t = Table.started({ players: 4 });
    const target = t.priv.target;
    t.leave("p3");
    expect(t.priv.target).toBe(target);
  });

  it("ends the game when a departure drops the room below the minimum", () => {
    const t = Table.started({ players: 3 });
    t.leave("p3");
    expect(t.phase).toBe("Lobby");
    expect(t.state.notice).toBe("Fewer than 3 players were left, so the game ended.");
  });

  it("completes the round when a departure removes the last chooser", () => {
    const t = Table.started({ options: { rounds: 1 }, players: 4 });
    t.share("p1");
    t.hold("p2");
    t.share("p3");
    expect(t.phase).toBe("Round");
    t.leave("p4");
    expect(t.phase).toBe("Verdict");
  });

  it("drops a leaver's pending choice and keeps their public reveal", () => {
    const t = Table.started({ players: 4 });
    const signal = t.priv.signals["p1"];
    if (signal === undefined) throw new Error("expected p1 to have a signal");
    t.share("p1");
    t.hold("p2");
    t.leave("p1");
    expect(t.priv.responses.size).toBe(1);
    expect(t.state.choices.map((c) => c.playerId)).toEqual(["p2"]);
    expect(revealOf(t, "p1")).toBe(signal);
  });

  it("ends the game when a departure in the verdict drops the room below the minimum", () => {
    const t = Table.started({ options: { rounds: 1 }, players: 3 });
    playToVerdict(t);
    t.leave("p3");
    expect(t.phase).toBe("Lobby");
    expect(t.state.notice).toBe("Fewer than 3 players were left, so the game ended.");
  });

  it("keeps the verdict going when a player leaves", () => {
    const t = Table.started({ options: { rounds: 1 }, players: 4 });
    playToVerdict(t);
    const signal = t.priv.signals["p4"];
    if (signal === undefined) throw new Error("expected p4 to have a signal");
    t.leave("p4");
    expect(t.phase).toBe("Verdict");
    expect(revealOf(t, "p4")).toBe(signal);
  });

  it("does not treat a dropped connection as a departure", () => {
    const t = Table.started({ players: 3 });
    t.drop("p3");
    expect(t.phase).toBe("Round");
    expect(t.state.mine.size).toBe(3);
    expect(t.state.reveals.length).toBe(0);
  });

  it("restores a reconnecting player's private entry", () => {
    const t = Table.started({ players: 3 });
    const signal = t.priv.signals["p3"];
    if (signal === undefined) throw new Error("expected p3 to have a signal");
    t.drop("p3");
    t.rejoin("p3");
    expect(t.state.mine.get("p3")?.signal).toBe(signal);
  });
});
