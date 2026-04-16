import { describe, expect, it } from "vitest";
import { WitClashGame } from "../index";

describe("WitClash Game Logic", () => {
  it("should transition from Lobby to CategorySelection when START_GAME is called", () => {
    const state = WitClashGame.initialState();
    const action = WitClashGame.phases.Lobby?.actions.START_GAME;

    action?.handler({ state, clientId: "host-id", data: {} });

    expect(state.phase).toBe("CategorySelection");
  });

  it("should set category and transition to Prompting on SELECT_CATEGORY", () => {
    const state = WitClashGame.initialState();
    state.phase = "CategorySelection";
    const action = WitClashGame.phases.CategorySelection?.actions.SELECT_CATEGORY;

    action?.handler({ state, clientId: "player-id", data: { category: "Standard" } });

    expect(state.category).toBe("Standard");
    expect(state.phase).toBe("Prompting");
  });

  it("should store prompts when SubmitAnswer is called", () => {
    const state = WitClashGame.initialState();
    state.phase = "Prompting";
    const action = WitClashGame.phases.Prompting?.actions.SubmitAnswer;

    action?.handler({ state, clientId: "p1", data: { answer: "Funny answer" } });

    expect(state.prompts.p1).toBe("Funny answer");
  });

  it("should record votes on CastVote action", () => {
    const state = WitClashGame.initialState();
    state.phase = "Voting";
    const action = WitClashGame.phases.Voting?.actions.CastVote;

    action?.handler({ state, clientId: "voter-1", data: { answerId: "p1" } });

    expect(state.votes.p1).toBe(1);

    action?.handler({ state, clientId: "voter-2", data: { answerId: "p1" } });
    expect(state.votes.p1).toBe(2);
  });

  it("should reset state on PLAY_AGAIN", () => {
    const state = WitClashGame.initialState();
    state.phase = "Results";
    state.prompts = { p1: "ans" };
    state.votes = { p1: 5 };

    const action = WitClashGame.phases.Results?.actions.PLAY_AGAIN;
    action?.handler({ state, clientId: "host", data: {} });

    expect(state.phase).toBe("Lobby");
    expect(state.prompts).toEqual({});
    expect(state.votes).toEqual({});
  });
});
