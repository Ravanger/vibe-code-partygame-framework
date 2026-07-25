import { describe, expect, it } from "vitest";
import { WitClashGame } from "../index";

describe("WitClash Game Logic", () => {
  it("should transition from Lobby to CategorySelection when START_GAME is called", () => {
    const state = WitClashGame.initialState();
    // biome-ignore lint/suspicious/noExplicitAny: test assertion
    const lobby = WitClashGame.phases.Lobby as any;
    if (!lobby) throw new Error("Lobby phase missing");

    lobby.actions.START_GAME.handler({ state, clientId: "host-id", data: {} });

    expect(state.phase).toBe("CategorySelection");
  });

  it("should set category and transition to Prompting on VOTE_CATEGORY", () => {
    const state = WitClashGame.initialState();
    state.phase = "CategorySelection";
    // biome-ignore lint/suspicious/noExplicitAny: test assertion
    const categorySelection = WitClashGame.phases.CategorySelection as any;
    if (!categorySelection) throw new Error("CategorySelection phase missing");

    categorySelection.actions.VOTE_CATEGORY.handler({
      state,
      clientId: "player-id",
      data: { categoryId: "Standard" },
    });

    expect(state.category).toBe("Standard");
    expect(state.phase).toBe("Prompting");
  });

  it("should store prompts when SUBMIT_ANSWER is called", () => {
    const state = WitClashGame.initialState();
    state.phase = "Prompting";
    // biome-ignore lint/suspicious/noExplicitAny: test assertion
    const prompting = WitClashGame.phases.Prompting as any;
    if (!prompting) throw new Error("Prompting phase missing");

    prompting.actions.SUBMIT_ANSWER.handler({
      state,
      clientId: "p1",
      data: { answer: "Funny answer" },
    });

    expect(state.prompts.p1).toBe("Funny answer");
  });

  it("should record votes on CAST_VOTE action", () => {
    const state = WitClashGame.initialState();
    state.phase = "Voting";
    // biome-ignore lint/suspicious/noExplicitAny: test assertion
    const voting = WitClashGame.phases.Voting as any;
    if (!voting) throw new Error("Voting phase missing");

    voting.actions.CAST_VOTE.handler({
      state,
      clientId: "voter-1",
      data: { answerId: "p1" },
    });

    expect(state.votes.p1).toBe(1);

    voting.actions.CAST_VOTE.handler({
      state,
      clientId: "voter-2",
      data: { answerId: "p1" },
    });
    expect(state.votes.p1).toBe(2);
  });

  it("should reset state on PLAY_AGAIN", () => {
    const state = WitClashGame.initialState();
    state.phase = "Results";
    state.prompts = { p1: "ans" };
    state.votes = { p1: 5 };

    // biome-ignore lint/suspicious/noExplicitAny: test assertion
    const results = WitClashGame.phases.Results as any;
    if (!results) throw new Error("Results phase missing");

    results.actions.PLAY_AGAIN.handler({ state, clientId: "host", data: {} });

    expect(state.phase).toBe("Lobby");
    expect(state.prompts).toEqual({});
    expect(state.votes).toEqual({});
  });
});
