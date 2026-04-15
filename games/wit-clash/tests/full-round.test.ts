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
      data: { text: "test" },
    };
    Prompting.actions.SUBMIT_ANSWER.handler(ctxSubmit);

    // Simulate VOTE
    const ctxVote = {
      state,
      clientId: "p2",
      data: { answerId: "p1" },
    };
    Voting.actions.VOTE.handler(ctxVote);

    expect(state.prompts.p1).toBe("test");
    expect(state.votes.p1).toBe(1);
  });
});
