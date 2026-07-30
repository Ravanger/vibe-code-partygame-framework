import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { TEST_DURATIONS } from "../src/rooms/GameRoom.js";
import { bootTestServer, type ColyseusTestServerType, sleep } from "./helpers/harness.js";

describe("Reconnection (D6)", () => {
  let colyseus: ColyseusTestServerType;
  beforeAll(async () => {
    colyseus = await bootTestServer();
  });
  afterEach(async () => {
    await colyseus.cleanup();
  });
  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("restores the same player row when rejoining with the same playerId", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const c1 = await colyseus.connectTo(room, { playerId: "uuid-1" });
    c1.send("SET_NAME", "Ada");
    await room.waitForNextPatch();
    expect(room.state.players.size).toBe(1);

    await c1.leave(false);
    const c2 = await colyseus.connectTo(room, { playerId: "uuid-1" });
    await room.waitForNextPatch();

    expect(room.state.players.size).toBe(1);
    const player = room.state.players.get(c2.sessionId);
    expect(player?.name).toBe("Ada");
    expect(player?.role).toBe("host");
    expect(player?.isConnected).toBe(true);
  });

  it("creates a separate player for a different playerId", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    await colyseus.connectTo(room, { playerId: "uuid-1" });
    await colyseus.connectTo(room, { playerId: "uuid-2" });
    await room.waitForNextPatch();
    expect(room.state.players.size).toBe(2);
  });

  it("keeps the room alive while the only player is away", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const c1 = await colyseus.connectTo(room, { playerId: "uuid-1" });
    const sessionId = c1.sessionId;
    await c1.leave(false);
    await room.waitForNextPatch();
    expect(room.state.players.size).toBe(1);
    expect(room.state.players.get(sessionId)?.isConnected).toBe(false);
  });

  it("removes the player when they leave deliberately", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    await colyseus.connectTo(room, { playerId: "uuid-1" });
    const c2 = await colyseus.connectTo(room, { playerId: "uuid-2" });
    await c2.leave(true);
    await room.waitForNextPatch();
    expect(room.state.players.size).toBe(1);
  });

  it("promotes a new host when the host leaves for good", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const host = await colyseus.connectTo(room, { playerId: "uuid-1" });
    const guest = await colyseus.connectTo(room, { playerId: "uuid-2" });
    await host.leave(true);
    await room.waitForNextPatch();
    expect(room.state.players.get(guest.sessionId)?.role).toBe("host");
  });

  it("disposes the room after the grace period with no reconnections", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const c1 = await colyseus.connectTo(room, { playerId: "uuid-1" });
    await c1.leave(false);
    await room.waitForNextPatch();
    expect(room.state.players.size).toBe(1);

    await sleep(TEST_DURATIONS.emptyRoomGraceMs + 50);
    expect(room.locked).toBe(true);
  });
});
