import { describe, expect, it } from "vitest";
import { WitClashGame } from "../index";

describe("WitClash Full Game Cycle", () => {
  it("should complete a full round of StartGame -> SubmitAnswer -> CastVote", () => {
    const state = WitClashGame.initialState();

    // Simulate StartGame
    // Assuming start game is handled by the state machine

    // Simulate SubmitAnswer
    const p1Ctx = {
      state,
      clientId: "p1",
      data: { answer: "Answer 1" }, // Using new schema
    };
    const p2Ctx = {
      state,
      clientId: "p2",
      data: { answer: "Answer 2" },
    };

    WitClashGame.phases.Prompting?.actions.SubmitAnswer?.handler(p1Ctx);
    WitClashGame.phases.Prompting?.actions.SubmitAnswer?.handler(p2Ctx);

    // Simulate CastVote
    const v1Ctx = {
      state,
      clientId: "p1",
      data: { answerId: "p2" }, // Using new schema
    };
    const v2Ctx = {
      state,
      clientId: "p2",
      data: { answerId: "p1" },
    };

    WitClashGame.phases.Voting?.actions.CastVote?.handler(v1Ctx);
    WitClashGame.phases.Voting?.actions.CastVote?.handler(v2Ctx);

    // Validate outcomes (accessing state correctly based on your schema)
    // Adjust expectations based on actual state structure
    expect(state.votes.p2).toBe(1);
    expect(state.votes.p1).toBe(1);
  });
});
