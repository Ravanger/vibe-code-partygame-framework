import { describe, it, expect } from "vitest";
import { defineGame } from "../src/index";

describe("defineGame", () => {
  it("creates a valid game definition", () => {
    const game = defineGame({
      name: "test-game",
      minPlayers: 2,
      maxPlayers: 4,
      initialState: () => ({}),
      phases: {},
    });

    expect(game.name).toBe("test-game");
    expect(game.minPlayers).toBe(2);
  });
});
