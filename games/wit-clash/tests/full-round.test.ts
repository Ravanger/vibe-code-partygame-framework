import { describe, expect, it } from "vitest";
import { WitClashGame } from "../index";

describe("WitClashGame Full Round", () => {
  it("should run a complete cycle", () => {
    const state = WitClashGame.initialState();
    const { Prompting, Voting } = WitClashGame.phases;

    // Simulate SubmitAnswer
    const ctxSubmit = {
      state,
      clientId: "p1",
      data: { answer: "test" },
    };
    Prompting.actions.SubmitAnswer.handler(ctxSubmit);

    // Simulate CastVote
    const ctxVote = {
      state,
      clientId: "p2",
      data: { answerId: "p1" },
    };
    Voting.actions.CastVote.handler(ctxVote);

    expect(state.prompts.p1).toBe("test");
    expect(state.votes.p1).toBe(1);
  });
});
