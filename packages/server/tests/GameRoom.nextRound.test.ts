import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PhaseDurations } from "../../src/rooms/GameRoom.js";
import { bootTestServer, seatPlayers, waitUntil } from "./helpers/harness.js";

const DURATIONS: PhaseDurations = {
  categoryVoteMs: 300,
  promptMs: 300,
  matchupVoteMs: 300,
  matchupRevealMs: 200,
  emptyRoomGraceMs: 200,
};

function voteCategory(
  // biome-ignore lint/suspicious/noExplicitAny: test harness uses any for room object
  room: any,
  // biome-ignore lint/suspicious/noExplicitAny: test harness uses any for clients array
  clients: any[],
) {
  const categoryId = room.state.categoryOptions[0]?.id;
  for (const client of clients) {
    client.send("ACTION", { type: "VOTE_CATEGORY", categoryId });
  }
}

function submitAllAnswers(
  // biome-ignore lint/suspicious/noExplicitAny: test harness uses any for room object
  room: any,
  // biome-ignore lint/suspicious/noExplicitAny: test harness uses any for clients array
  clients: any[],
) {
  for (const matchup of room.state.matchups) {
    for (const client of clients) {
      client.send("ACTION", {
        type: "SUBMIT_ANSWER",
        matchupId: matchup.id,
        answer: "test answer",
      });
    }
  }
}

describe("GameRoom — NEXT_ROUND", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await bootTestServer(DURATIONS);
  });

  afterEach(async () => {
    await colyseus?.cleanup();
  });

  afterAll(async () => {
    await colyseus?.shutdown();
  });

  it("enters Prompting for round 2 after the host sends NEXT_ROUND", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);

    await waitUntil(() => room.state.phase === "CategorySelection", "category selection");
    voteCategory(room, clients);
    await waitUntil(() => room.state.phase === "Prompting", "round 1 prompting");
    submitAllAnswers(room, clients);
    await waitUntil(() => room.state.phase === "Voting", "round 1 voting");
    await waitUntil(() => room.state.phase === "Results", "round 1 results", 15000);
    expect(room.state.phase).toBe("Results");
    expect(room.state.roundNumber).toBe(1);

    // clients[0] is the host (first seated player).
    clients[0]?.send("ACTION", { type: "NEXT_ROUND" });
    await waitUntil(() => room.state.phase === "Prompting", "round 2 prompting", 5000);
    expect(room.state.phase).toBe("Prompting");
    expect(room.state.roundNumber).toBe(2);
  }, 30000);
});
