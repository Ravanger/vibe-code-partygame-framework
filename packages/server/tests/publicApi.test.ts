import { describe, expect, it } from "vitest";
import * as api from "../src/index.js";

describe("public API", () => {
  it("exports the game server surface", () => {
    expect(Object.keys(api).sort()).toEqual([
      "BaseGameState",
      "DEFAULT_ACTION_BUCKET",
      "DEFAULT_EMPTY_ROOM_GRACE_MS",
      "DEFAULT_MAX_PAYLOAD_BYTES",
      "DEFAULT_MAX_ROOMS",
      "DEFAULT_RECONNECT_MS",
      "DEFAULT_RESOLVE_CODE_BUCKET",
      "DEFAULT_SET_NAME_BUCKET",
      "GameRoom",
      "PlayerSchema",
      "RateLimiter",
      "RoomCodeService",
      "createApiHandler",
      "createGameServer",
    ]);
  });
});
