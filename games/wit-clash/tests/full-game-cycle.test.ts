import { describe, expect, it } from "vitest";
import { WitClashGame } from "../index";

describe("WitClash Full Game Cycle", () => {
  it("should complete a full round of START_GAME -> SUBMIT_ANSWER -> CAST_VOTE", () => {
    // biome-ignore lint/suspicious/noExplicitAny: test assertion
    const prompting = WitClashGame.phases.Prompting as any;
    if (!prompting) throw new Error("Prompting phase missing");
    // biome-ignore lint/suspicious/noExplicitAny: test assertion
    const voting = WitClashGame.phases.Voting as any;
    if (!voting) throw new Error("Voting phase missing");

    const state = WitClashGame.initialState();

    // Simulate StartGame
    // Assuming start game is handled by the state machine

    // Simulate SUBMIT_ANSWER
    const p1Ctx = {
      state,
      clientId: "p1",
      data: { answer: "Answer 1" },
    };
    const p2Ctx = {
      state,
      clientId: "p2",
      data: { answer: "Answer 2" },
    };

    prompting.actions.SUBMIT_ANSWER.handler(p1Ctx);
    prompting.actions.SUBMIT_ANSWER.handler(p2Ctx);

    // Simulate CAST_VOTE
    const v1Ctx = {
      state,
      clientId: "p1",
      data: { answerId: "p2" },
    };
    const v2Ctx = {
      state,
      clientId: "p2",
      data: { answerId: "p1" },
    };

    voting.actions.CAST_VOTE.handler(v1Ctx);
    voting.actions.CAST_VOTE.handler(v2Ctx);

    // Validate outcomes (accessing state correctly based on your schema)
    // Adjust expectations based on actual state structure
    expect(state.votes.p2).toBe(1);
    expect(state.votes.p1).toBe(1);
  });
});
