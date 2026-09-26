import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PhaseDurations } from "../src/rooms/GameRoom.js";
import { bootTestServer, seatPlayers, waitUntil } from "./helpers/harness.js";

describe("GameRoom — consented leave during Prompting (Bug 3)", () => {
  let colyseus: ColyseusTestServer;
  // Long prompt window so only an explicit resolution can advance the phase.
  const durations: PhaseDurations = {
    categoryVoteMs: 80,
    promptMs: 30000,
    matchupVoteMs: 2000,
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

  it("recomputes answersExpected and resolves when the leaver was the only missing submitter", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);

    const opts = room.state.categoryOptions;
    for (const client of clients) {
      client.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]?.id });
    }
    await waitUntil(() => room.state.phase === "Prompting", "phase=Prompting");

    // Players B and C submit; player A does not.
    for (const m of room.state.matchups) {
      clients[1]?.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: m.id, answer: "b" });
      clients[2]?.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: m.id, answer: "c" });
    }
    await room.waitForNextPatch();
    expect(room.state.answersSubmitted).toBe(4);

    // Player A leaves for good.
    await clients[0]?.leave(true);
    await room.waitForNextPatch();

    // The leaver's two assignments must be removed from the expected total...
    expect(room.state.answersExpected).toBe(4);
    // ...and with everyone remaining already submitted, Prompting resolves at once.
    await waitUntil(() => room.state.phase === "Voting", "phase=Voting");
  });
});
