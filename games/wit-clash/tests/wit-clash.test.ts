import { describe, expect, it } from "vitest";
import { WitClashGame } from "../index";

describe("WitClash Definition", () => {
  it("should initialize with correct default state", () => {
    const state = WitClashGame.initialState();
    expect(state.scores).toEqual({});
    expect(state.prompts).toEqual({});
    expect(state.votes).toEqual({});
    expect(state.category).toBe("");
  });
});
