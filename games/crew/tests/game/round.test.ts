import { describe, expect, it } from "vitest";
import { ROLES } from "../../src/crew.js";
import { revealOf, Table } from "./support.js";

describe("Round (dealing)", () => {
  it("deals a unique role and a private signal to every player", () => {
    const t = Table.started();
    expect(t.phase).toBe("Round");
    expect(t.state.round).toBe(1);
    expect(t.state.totalRounds).toBe(2);
    expect(t.state.roles.size).toBe(4);
    const roles = [...t.state.roles.values()];
    expect(new Set(roles).size).toBe(4);
    for (const role of roles) expect(ROLES).toContain(role);
    expect(t.state.mine.size).toBe(4);
    for (const playerId of t.ids()) {
      const signal = t.state.mine.get(playerId)?.signal;
      expect(signal).toBeGreaterThanOrEqual(1);
      expect(signal).toBeLessThanOrEqual(9);
    }
    expect(t.state.reveals.length).toBe(0);
    expect(t.state.choices.length).toBe(0);
    expect(t.state.guesses.length).toBe(0);
    expect(t.state.outcome).toBe("");
  });

  it("reveals each player's signal only to that player", () => {
    const t = Table.started();
    for (const playerId of t.ids()) {
      const shown = t.host.views.filter((v) => v.op === "show" && v.playerId === playerId);
      expect(shown.map((v) => v.ref)).toEqual([t.state.mine.get(playerId)]);
    }
  });

  it("respects a custom rounds option", () => {
    const t = Table.started({ options: { rounds: 5 } });
    expect(t.state.totalRounds).toBe(5);
  });

  it("locks the target to the sum of the starting crew's signals", () => {
    const t = Table.started();
    const sum = Object.values(t.priv.signals).reduce((a, b) => a + b, 0);
    expect(t.priv.target).toBe(sum);
  });
});

describe("Round (choices)", () => {
  it("records a shared choice and reveals the sharer's signal publicly", () => {
    const t = Table.started();
    t.share("p1");
    expect(t.state.choices.map((c) => [c.playerId, c.choice])).toEqual([["p1", "share"]]);
    expect(revealOf(t, "p1")).toBe(t.priv.signals["p1"]);
  });

  it("records a held choice without revealing the signal", () => {
    const t = Table.started();
    t.hold("p1");
    expect(t.state.choices.map((c) => [c.playerId, c.choice])).toEqual([["p1", "hold"]]);
    expect(t.state.reveals.length).toBe(0);
  });

  it("rejects a second choice from the same player", () => {
    const t = Table.started();
    t.share("p1");
    let error = t.act("p1", "SHARE");
    expect(error?.code).toBe("NOT_ALLOWED");
    expect(error?.message).toBe("You already chose this round");
    t.hold("p2");
    error = t.act("p2", "HOLD");
    expect(error?.code).toBe("NOT_ALLOWED");
  });

  it("moves to the next round once everyone has chosen", () => {
    const t = Table.started();
    t.share("p1");
    t.hold("p2");
    t.share("p3");
    expect(t.phase).toBe("Round");
    t.hold("p4");
    expect(t.phase).toBe("Round");
    expect(t.state.round).toBe(2);
    expect(t.state.choices.length).toBe(0);
    expect(t.priv.responses.size).toBe(0);
    expect(t.state.reveals.length).toBe(2);
  });

  it("advances on the timeout with only the recorded choices", () => {
    const t = Table.started();
    t.share("p1");
    t.tick(20_000);
    expect(t.phase).toBe("Round");
    expect(t.state.round).toBe(2);
    expect(t.priv.responses.size).toBe(0);
    expect(revealOf(t, "p1")).toBe(t.priv.signals["p1"]);
  });

  it("restarts the round timer on re-entry", () => {
    const t = Table.started();
    t.tick(19_000); // the first round would time out at t=20s
    for (const id of t.ids()) t.share(id); // re-enter round two at t=19s
    expect(t.state.round).toBe(2);
    t.tick(1_000); // t=20s: the old timer expired here, the restarted one has 19s left
    expect(t.phase).toBe("Round");
    expect(t.state.round).toBe(2);
  });

  it("moves to the Verdict after the final round completes", () => {
    const t = Table.started({ options: { rounds: 1 } });
    for (const id of t.ids()) t.share(id);
    expect(t.phase).toBe("Verdict");
    expect(t.state.choices.length).toBe(4);
  });

  it("ignores SHARE outside the Round phase", () => {
    const t = new Table();
    const error = t.act("p1", "SHARE");
    expect(error?.code).toBe("WRONG_PHASE");
  });

  it("excludes a benched mid-game joiner from the crew", () => {
    const t = Table.started();
    t.joinLate("p5");
    expect(t.state.roles.size).toBe(4);
    expect(t.priv.participants.has("p5")).toBe(false);
    for (const id of ["p1", "p2", "p3", "p4"]) t.share(id);
    expect(t.phase).toBe("Round");
    expect(t.state.round).toBe(2);
    expect(t.priv.participants.has("p5")).toBe(false);
  });

  it("shows an empty name for a player who never chose one", () => {
    const t = Table.started({ seats: [{}, {}, {}, { name: "" }] });
    t.share("p4");
    expect(t.state.choices[0]?.name).toBe("");
  });
});
