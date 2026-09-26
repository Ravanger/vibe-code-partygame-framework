import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { bootTestServer, seatPlayers, waitUntil } from "./helpers/harness.js";

describe("GameRoom — max players", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await bootTestServer();
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("rejects the (maxPlayers + 1)th join", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    // WitClashGame.maxPlayers = 8 — fill the room exactly.
    await seatPlayers(colyseus, room, 8);
    await waitUntil(() => room.state.players.size === 8, "room full with 8 players");

    // The next joiner must be rejected by Colyseus (maxClients).
    await expect(colyseus.connectTo(room, { playerId: "uuid-8" })).rejects.toThrow();
  });
});
