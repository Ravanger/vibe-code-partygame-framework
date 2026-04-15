import { describe, expect, it } from "vitest";
import { WitClashGame } from "../index";

describe("WitClash Full Game Cycle", () => {
  it("should complete a full round of Prompting -> Voting", () => {
    const state = WitClashGame.initialState();
    const { Prompting, Voting } = WitClashGame.phases;

    const p1Ctx = {
      state,
      clientId: "p1",
      data: { text: "Answer 1" },
    };
    const p2Ctx = {
      state,
      clientId: "p2",
      data: { text: "Answer 2" },
    };

    Prompting.actions.SUBMIT_ANSWER.handler(p1Ctx);
    Prompting.actions.SUBMIT_ANSWER.handler(p2Ctx);

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

    Voting.actions.VOTE.handler(v1Ctx);
    Voting.actions.VOTE.handler(v2Ctx);

    expect(state.votes["p2"]).toBe(1);
    expect(state.votes["p1"]).toBe(1);
  });
});
