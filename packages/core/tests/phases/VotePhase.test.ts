import { describe, expect, it } from "vitest";
import { VotePhase } from "../../src/phases/VotePhase.js";

describe("VotePhase", () => {
  it("should handle CastVote and increment votes", () => {
    const phase = new VotePhase();
    phase.handleAction("p1", { type: "CastVote", answerId: "p2_a1" });
    expect(phase.getVotes()["p2_a1"]).toBe(1);
  });

  it("should throw for self-voting", () => {
    const phase = new VotePhase();
    expect(() => phase.handleAction("p1", { type: "CastVote", answerId: "p1_a1" })).toThrow("Cannot vote for self");
  });

  it("should throw for invalid action type", () => {
    const phase = new VotePhase();
    expect(() => phase.handleAction("p1", { type: "Invalid" as any, answerId: "p2" })).toThrow("Invalid Action");
  });

  it("should compute visibility", () => {
    const phase = new VotePhase();
    expect(phase.computeVisibility()).toEqual({ phase: "Voting" });
  });
});
