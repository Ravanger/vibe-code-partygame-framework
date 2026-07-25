import { describe, expect, it } from "vitest";
import { WitClashGame } from "../index";

describe("WitClashGame Full Round", () => {
  it("should run a complete cycle", () => {
    const state = WitClashGame.initialState();
    // biome-ignore lint/suspicious/noExplicitAny: test assertion
    const prompting = WitClashGame.phases.Prompting as any;
    if (!prompting) throw new Error("Prompting phase missing");
    // biome-ignore lint/suspicious/noExplicitAny: test assertion
    const voting = WitClashGame.phases.Voting as any;
    if (!voting) throw new Error("Voting phase missing");

    // Simulate SUBMIT_ANSWER
    const ctxSubmit = {
      state,
      clientId: "p1",
      data: { answer: "test" },
    };
    prompting.actions.SUBMIT_ANSWER.handler(ctxSubmit);

    // Simulate CAST_VOTE
    const ctxVote = {
      state,
      clientId: "p2",
      data: { answerId: "p1" },
    };
    voting.actions.CAST_VOTE.handler(ctxVote);

    expect(state.prompts.p1).toBe("test");
    expect(state.votes.p1).toBe(1);
  });
});
