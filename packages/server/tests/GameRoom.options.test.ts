import { matchMaker, type Room } from "@colyseus/core";
import { BaseGameState } from "@partygame/shared/schema";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bootTestServer, type TestServer } from "../src/testing/index.js";
import { BuzzerGame, BuzzerState, PlainGame } from "./fixtures/buzzer.js";

let t: TestServer;
beforeAll(async () => {
  t = await bootTestServer({
    games: [
      { roomName: "plain", definition: PlainGame, stateClass: BaseGameState },
      { roomName: "buzzer", definition: BuzzerGame, stateClass: BuzzerState },
    ],
  });
});
afterAll(() => t.shutdown());

describe("GameRoom with invalid create options", () => {
  it("fails to create and never registers a room code", async () => {
    const register = vi.spyOn(t.roomCodeService, "generateAndRegister");
    const unregister = vi.spyOn(t.roomCodeService, "unregister");
    await expect(t.createRoom("buzzer", { buzzMs: "x" })).rejects.toThrow();
    expect(register).not.toHaveBeenCalled();
    expect(unregister).not.toHaveBeenCalled();
    register.mockRestore();
    unregister.mockRestore();
  });
});

describe("GameRoom without an options schema", () => {
  it("publishes the raw create options minus framework keys", async () => {
    const room = await t.createRoom("plain", {
      playerId: "x",
      name: "y",
      spectator: true,
      theme: "dark",
    });
    expect(JSON.parse((room.state as BaseGameState).options)).toEqual({ theme: "dark" });
  });

  it("tolerates room creation without options", async () => {
    const listing = await matchMaker.createRoom("plain", undefined as never);
    const room = matchMaker.getLocalRoomById(listing.roomId) as Room;
    expect((room.state as BaseGameState).options).toBe("{}");
  });
});
