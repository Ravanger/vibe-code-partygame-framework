import { describe, expect, it } from "vitest";
import { __camelName__Game } from "../../src/hostedGame.js";
import { ROOM_NAME } from "../../src/roomName.js";
import { __PascalName__State } from "../../src/state.js";

describe("__camelName__Game", () => {
  it("describes the wave game for a server to host", () => {
    const game = __camelName__Game();
    expect(game.roomName).toBe(ROOM_NAME);
    expect(game.stateClass).toBe(__PascalName__State);
    expect(game.definition.name).toBe(__DisplayNameJson__);
  });
});
