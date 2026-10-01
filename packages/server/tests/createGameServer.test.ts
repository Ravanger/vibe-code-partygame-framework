import { WebSocketTransport } from "@colyseus/ws-transport";
import { afterEach, describe, expect, it } from "vitest";
import { createGameServer } from "../src/createGameServer.js";
import { RoomCodeService } from "../src/services/RoomCodeService.js";
import { bootTestServer, type TestServer } from "../src/testing/index.js";
import { GAMES, stateOf } from "./support.js";

let t: TestServer | undefined;
afterEach(async () => {
  await t?.shutdown();
  t = undefined;
});

describe("createGameServer", () => {
  it("defines one room type per game with default timings and a fresh code service", async () => {
    expect(createGameServer({ games: GAMES })).toBeDefined();
    t = await bootTestServer({ games: GAMES.map((game) => ({ ...game, roomName: "other" })) });
    const room = await t.createRoom("other");
    expect(stateOf(room).roomCode).toMatch(/^[A-Z]{4}$/);
  });

  it("accepts a transport, a shared code service and explicit timings", () => {
    const server = createGameServer({
      games: GAMES,
      roomCodeService: new RoomCodeService(),
      transport: new WebSocketTransport(),
      reconnectMs: 10,
      emptyRoomGraceMs: 20,
    });
    expect(server).toBeDefined();
  });

  it("boots the test helper with a shared code service", async () => {
    const roomCodeService = new RoomCodeService();
    t = await bootTestServer({ games: GAMES, roomCodeService });
    expect(t.roomCodeService).toBe(roomCodeService);
  });
});
