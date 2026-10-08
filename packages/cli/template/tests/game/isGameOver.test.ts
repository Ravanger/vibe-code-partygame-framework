import { describe, expect, it } from "vitest";
import { isGameOver } from "../../src/isGameOver.js";
import { PHASE } from "../../src/phaseNames.js";
import { __PascalName__State } from "../../src/state.js";

describe("isGameOver", () => {
  it("is true only on the results screen", () => {
    const state = new __PascalName__State();
    state.phase = PHASE.Waving;
    expect(isGameOver(state)).toBe(false);
    state.phase = PHASE.Results;
    expect(isGameOver(state)).toBe(true);
  });
});
