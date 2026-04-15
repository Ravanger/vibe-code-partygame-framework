import type { GameAction } from "@partygame/shared";
import { describe, expect, it } from "vitest";
import { VotePhase } from "../../src/phases/VotePhase.js";

describe("VotePhase", () => {
  it("should create instance via constructor", () => {
    const phase = new VotePhase();
    expect(phase).toBeDefined();
  });

  it("should handle CastVote and increment votes", () => {
    const phase = new VotePhase();
    phase.handleAction("p1", { type: "CastVote", answerId: "p2_a1" });
    expect(phase.getVotes()["p2_a1"]).toBe(1);
  });

  it("should throw for self-voting", () => {
    const phase = new VotePhase();
    expect(() => phase.handleAction("p1", { type: "CastVote", answerId: "p1_a1" })).toThrow(
      "Cannot vote for self",
    );
  });

  it("should throw for invalid action type", () => {
    const phase = new VotePhase();
    expect(() =>
      phase.handleAction("p1", { type: "Invalid", answerId: "p2" } as GameAction),
    ).toThrow("Invalid Action");
  });

  it("should compute visibility", () => {
    const phase = new VotePhase();
    expect(phase.computeVisibility()).toEqual({ phase: "Voting" });
  });

  it("should handle multiple votes for same answer", () => {
    const phase = new VotePhase();
    phase.handleAction("p1", { type: "CastVote", answerId: "p2_a1" });
    phase.handleAction("p3", { type: "CastVote", answerId: "p2_a1" });
    phase.handleAction("p4", { type: "CastVote", answerId: "p2_a1" });
    expect(phase.getVotes()["p2_a1"]).toBe(3);
  });

  it("should handle votes for different answers", () => {
    const phase = new VotePhase();
    phase.handleAction("p1", { type: "CastVote", answerId: "p2_a1" });
    phase.handleAction("p3", { type: "CastVote", answerId: "p4_a1" });
    expect(phase.getVotes()["p2_a1"]).toBe(1);
    expect(phase.getVotes()["p4_a1"]).toBe(1);
  });

  it("should return empty votes initially", () => {
    const phase = new VotePhase();
    expect(Object.keys(phase.getVotes()).length).toBe(0);
  });
});
