import { describe, expect, it } from "vitest";
import { Table } from "./support.js";

describe("Writing", () => {
  it("starts round one with a drawn prompt and the option's total rounds", () => {
    const t = Table.started();
    expect(t.phase).toBe("Writing");
    expect(t.state.roundNumber).toBe(1);
    expect(t.state.totalRounds).toBe(3);
    expect(t.state.promptText).toBe("What is the capital of Australia?");
    expect(t.state.choices.length).toBe(0);
    expect(t.state.progress.size).toBe(0);
  });

  it("respects a custom rounds option", () => {
    const t = Table.started({ options: { rounds: 5 } });
    expect(t.state.totalRounds).toBe(5);
  });

  it("stores a fake answer and marks the player's progress", () => {
    const t = Table.started();
    t.submitFake("p1", "Sydney");
    expect([...(t.priv.fakes.get("p1")?.values() ?? [])]).toEqual(["Sydney"]);
    expect(t.state.progress.get("p1")).toBe(true);
    expect(t.phase).toBe("Writing");
  });

  it("rejects a second fake answer from the same player", () => {
    const t = Table.started();
    t.submitFake("p1", "Sydney");
    const error = t.act("p1", "SUBMIT_FAKE", { text: "Melbourne" });
    expect(error?.message).toBe("You already submitted your answer");
    expect([...(t.priv.fakes.get("p1")?.values() ?? [])]).toEqual(["Sydney"]);
  });

  it("rejects an empty fake answer", () => {
    const t = Table.started();
    const error = t.act("p1", "SUBMIT_FAKE", { text: "   " });
    expect(error?.code).toBe("INVALID_ACTION");
  });

  it("moves to Voting once every active player has submitted", () => {
    const t = Table.started();
    t.submitFake("p1", "Sydney");
    t.submitFake("p2", "Perth");
    t.submitFake("p3", "Brisbane");
    expect(t.phase).toBe("Writing");
    t.submitFake("p4", "Adelaide");
    expect(t.phase).toBe("Voting");
  });

  it("moves to Voting on the timeout, leaving late answers out", () => {
    const t = Table.started();
    t.submitFake("p1", "Sydney");
    t.tick(45_000);
    expect(t.phase).toBe("Voting");
    expect(t.priv.fakes.has("p2")).toBe(false);
  });

  it("ignores SUBMIT_FAKE outside the Writing phase", () => {
    const t = Table.started();
    t.tick(45_000);
    const error = t.act("p1", "SUBMIT_FAKE", { text: "Sydney" });
    expect(error?.code).toBe("WRONG_PHASE");
  });

  it("moves to Voting when a departure completes the submissions", () => {
    const t = Table.started();
    t.submitFake("p1", "Sydney");
    t.submitFake("p2", "Perth");
    t.submitFake("p3", "Brisbane");
    expect(t.phase).toBe("Writing");
    t.leave("p4");
    expect(t.phase).toBe("Voting");
    expect(t.priv.fakes.has("p4")).toBe(false);
  });

  it("drops a leaver's fake and keeps going when enough players remain", () => {
    const t = Table.started();
    t.submitFake("p1", "Sydney");
    t.submitFake("p4", "Adelaide");
    t.leave("p4");
    expect(t.priv.fakes.has("p4")).toBe(false);
    expect(t.state.progress.get("p4")).toBeUndefined();
    expect(t.phase).toBe("Writing");
  });

  it("ends the game when a departure drops the room below the minimum", () => {
    const t = Table.started({ players: 3 });
    t.leave("p3");
    expect(t.phase).toBe("Lobby");
    expect(t.state.notice).toBe("Fewer than 3 players were left, so the game ended.");
  });

  it("does not end the game on a dropped connection", () => {
    const t = Table.started({ players: 3 });
    t.drop("p3");
    expect(t.phase).toBe("Writing");
  });
});
