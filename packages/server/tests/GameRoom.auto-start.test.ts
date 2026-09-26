import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PhaseDurations } from "../src/rooms/GameRoom.js";
import { bootTestServer, sleep, waitUntil } from "./helpers/harness.js";

interface TestRoomState {
  phase: string;
  players: Map<string, { isReady: boolean }>;
}

interface TestClient {
  send: (type: string, payload?: unknown) => void;
}

describe("GameRoom — auto-start waits for every joined player", () => {
  let colyseus: ColyseusTestServer;
  const durations: PhaseDurations = {
    categoryVoteMs: 80,
    promptMs: 30000,
    matchupVoteMs: 30000,
    matchupRevealMs: 500,
    emptyRoomGraceMs: 10000,
    reconnectMs: 10000,
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

  /** Join n clients without naming them: seatPlayers() names everyone at once. */
  async function joinUnnamed(room: { state: TestRoomState }, n: number): Promise<TestClient[]> {
    const clients: TestClient[] = [];
    for (let i = 0; i < n; i++) {
      clients.push(await colyseus.connectTo(room as never, { playerId: `uuid-${i}` }));
    }
    await waitUntil(() => room.state.players.size === n, `${n} players joined`);
    return clients;
  }

  function readyCount(room: { state: TestRoomState }): number {
    return Array.from(room.state.players.values()).filter((p) => p.isReady).length;
  }

  it("does not auto-start when 3 of 4 joined players are ready", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await joinUnnamed(room, 4);

    clients[0].send("SET_NAME", "Alice");
    clients[1].send("SET_NAME", "Bob");
    clients[2].send("SET_NAME", "Carol");
    // Dave is still typing his name...
    await waitUntil(() => readyCount(room) === 3, "3 players ready");
    await sleep(300);
    // minPlayers=3 is met, but the 4th joined player has no name yet.
    expect(room.state.phase).toBe("Lobby");

    clients[3].send("SET_NAME", "Dave");
    await waitUntil(() => room.state.phase === "CategorySelection", "auto-start fired");
  });

  it("host can still start manually before everyone is ready", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await joinUnnamed(room, 4);

    clients[0].send("SET_NAME", "Alice"); // host
    clients[1].send("SET_NAME", "Bob");
    clients[2].send("SET_NAME", "Carol");
    await waitUntil(() => readyCount(room) === 3, "3 players ready");
    expect(room.state.phase).toBe("Lobby");

    clients[0].send("ACTION", { type: "START_GAME" });
    await waitUntil(() => room.state.phase === "CategorySelection", "manual start fired");
  });

  it("still auto-starts when exactly minPlayers are joined and all are ready", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await joinUnnamed(room, 3);

    clients[0].send("SET_NAME", "Alice");
    clients[1].send("SET_NAME", "Bob");
    clients[2].send("SET_NAME", "Carol");
    await waitUntil(() => room.state.phase === "CategorySelection", "auto-start fired");
  });
});
