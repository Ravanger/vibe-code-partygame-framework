import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PhaseDurations } from "../src/rooms/GameRoom.js";
import { bootTestServer, seatPlayers, waitUntil } from "./helpers/harness.js";

describe("GameRoom — abandoned host (reconnect grace expiry)", () => {
  let colyseus: ColyseusTestServer;
  const durations: PhaseDurations = {
    categoryVoteMs: 80,
    promptMs: 30000,
    matchupVoteMs: 2000,
    matchupRevealMs: 500,
    emptyRoomGraceMs: 10000,
    // Short grace so the test can observe seat finalization quickly.
    reconnectMs: 1000,
  };

  beforeAll(async () => {
    colyseus = await bootTestServer(durations);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("holds the seat, then removes the ghost and promotes a new host when nobody reconnects", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    const clientA = clients[0];
    if (!clientA) throw new Error("expected 3 seated clients");
    expect(room.state.players.get(clientA.sessionId)?.role).toBe("host");

    // Abnormal disconnect: the seat must be held for reconnection...
    await clientA.leave(false);
    await waitUntil(() => {
      const p = room.state.players.get(clientA.sessionId);
      return !!p && !p.isConnected;
    }, "seat held with isConnected=false");

    // ...but when the grace period expires without a reconnect, the ghost must be
    // removed and host duties reassigned (Colyseus never calls onLeave again).
    await waitUntil(
      () => {
        if (room.state.players.get(clientA.sessionId)) return false;
        return Array.from(room.state.players.values()).some(
          (p) => p.role === "host" && p.isConnected,
        );
      },
      "ghost removed and a connected player promoted to host",
      3500,
    );
    expect(Array.from(room.state.players.values())).toHaveLength(2);
  });
});
