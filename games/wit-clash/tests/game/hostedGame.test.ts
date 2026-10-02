import { describe, expect, it } from "vitest";
import { witClashGame } from "../../src/hostedGame.js";
import { ROOM_NAME } from "../../src/roomName.js";
import { WitClashState } from "../../src/state.js";
import { makeCategories } from "./support.js";

describe("witClashGame", () => {
  it("describes WitClash for a server to host", () => {
    const game = witClashGame(makeCategories());
    expect(game.roomName).toBe(ROOM_NAME);
    expect(game.stateClass).toBe(WitClashState);
    expect(game.definition.name).toBe("WitClash");
  });
});
