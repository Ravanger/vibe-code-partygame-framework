import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PhaseDurations } from "../src/rooms/GameRoom.js";
import { bootTestServer, seatPlayers, waitUntil } from "./helpers/harness.js";

describe("GameRoom — Prompting reconnect (Bug 1)", () => {
  let colyseus: ReturnType<typeof bootTestServer>;
  const durations: PhaseDurations = {
    categoryVoteMs: 80,
    // Long prompt window so the phase cannot expire while we disconnect/reconnect.
    promptMs: 30000,
    matchupVoteMs: 2000,
    matchupRevealMs: 500,
    emptyRoomGraceMs: 10,
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

  it("reconnect during Prompting does not double-count resubmitted answers", async () => {
    // Create room and seat 3 players
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);

    // Vote on category to advance to Prompting
    const opts = room.state.categoryOptions;
    for (const client of clients) {
      client.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]?.id });
    }
    await waitUntil(() => room.state.phase === "Prompting", "phase=Prompting");

    // Matchup ids live in public state and stay valid across reconnects.
    const matchups = [...room.state.matchups];

    // Player A submits (ring pairing: clients[0] is author of exactly 2 matchups).
    const playerA = clients[0];
    for (const m of matchups) {
      playerA?.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: m.id, answer: "test" });
    }
    await room.waitForNextPatch();

    // Record answersSubmitted after initial submission (should be 2 for player A)
    const submittedAfterInitial = room.state.answersSubmitted;
    expect(submittedAfterInitial).toBe(2);

    // Abnormal disconnect: leave(false) closes the socket without sending LEAVE_ROOM.
    await playerA.leave(false);
    await waitUntil(() => {
      const players = Array.from(room.state.players.values());
      return players.some((p) => p.playerId === "uuid-0" && !p.isConnected);
    }, "player A disconnected");

    // Player A reconnects with same playerId but new sessionId
    const playerAReconnected = await colyseus.connectTo(room, { playerId: "uuid-0" });
    await room.waitForNextPatch();

    // Wait for reconnection to be established
    await waitUntil(() => {
      const players = Array.from(room.state.players.values());
      return players.some((p) => p.playerId === "uuid-0" && p.isConnected);
    }, "player A reconnected");

    // Player A resubmits the same answers from the new session.
    for (const m of matchups) {
      playerAReconnected.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: m.id, answer: "test" });
    }
    await room.waitForNextPatch();

    // After resubmission, answersSubmitted should NOT have increased (rekeyPromptingState
    // should have moved the drafts to the new session id)
    expect(room.state.answersSubmitted).toBe(submittedAfterInitial);
  });
});
