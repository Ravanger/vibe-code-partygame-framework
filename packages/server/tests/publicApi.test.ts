import { describe, expect, it } from "vitest";
import * as api from "../src/index.js";

describe("public API", () => {
  it("exports the game server surface", () => {
    expect(Object.keys(api).sort()).toEqual([
      "BaseGameState",
      "DEFAULT_EMPTY_ROOM_GRACE_MS",
      "DEFAULT_RECONNECT_MS",
      "GameRoom",
      "PlayerSchema",
      "RoomCodeService",
      "createApiHandler",
      "createGameServer",
    ]);
  });
});
