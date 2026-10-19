import { describe, expect, it } from "vitest";
import { isGameOver } from "../../src/isGameOver.js";
import { PHASE } from "../../src/phaseNames.js";
import { BluffState } from "../../src/state.js";

describe("isGameOver", () => {
  it("is true only on the results screen", () => {
    const state = new BluffState();
    state.phase = PHASE.Writing;
    expect(isGameOver(state)).toBe(false);
    state.phase = PHASE.Results;
    expect(isGameOver(state)).toBe(true);
  });
});
