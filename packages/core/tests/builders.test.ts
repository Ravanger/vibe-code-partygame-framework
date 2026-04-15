import { describe, expect, it, vi } from "vitest";
import { createAction, createPhase, defineGame } from "../dist/index.js";

describe("DSL builders", () => {
  it("createAction should return the config passed to it", () => {
    const handler = vi.fn();
    const config = { from: "player" as const, handler };
    const action = createAction(config);
    expect(action).toEqual(config);
  });

  it("createPhase should return the config passed to it", () => {
    const config = { actions: {} };
    const phase = createPhase(config);
    expect(phase).toEqual(config);
  });

  it("defineGame should return the config passed to it", () => {
    const config = {
      name: "Test Game",
      minPlayers: 2,
      maxPlayers: 4,
      initialState: () => ({}),
      phases: {},
    };
    const game = defineGame(config);
    expect(game).toEqual(config);
  });
});
