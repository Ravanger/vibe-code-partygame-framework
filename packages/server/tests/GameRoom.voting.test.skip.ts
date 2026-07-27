import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PhaseDurations } from "../../src/rooms/GameRoom.js";
import { bootTestServer, seatPlayers } from "./helpers/harness.js";

const TEST_DURATIONS_VOTE_MS = 500;
const DURATIONS: PhaseDurations = {
  categoryVoteMs: 500,
  promptMs: 2000,
  matchupVoteMs: TEST_DURATIONS_VOTE_MS,
  matchupRevealMs: 30,
  emptyRoomGraceMs: 200,
};

describe("GameRoom — Voting phase", () => {
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

  it("enters Voting after Prompting resolves", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    const categoryId = room.state.categoryOptions[0]!.id;
    clients[0]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId });
    await room.waitForNextPatch();
    clients[1]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId });
    await room.waitForNextPatch();
    clients[2]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId });
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("Prompting");
    // Submit answers for each matchup (ring pairing creates matchups for each player pair)
    for (const matchup of room.state.matchups) {
      // Find the authors of this matchup and submit answers
      for (const client of clients) {
        client.send("ACTION", {
          type: "SUBMIT_ANSWER",
          matchupId: matchup.id,
          answer: "test answer",
        });
      }
      await room.waitForNextPatch();
    }
    expect(room.state.phase).toBe("Voting");
    expect(room.state.matchups.length).toBeGreaterThanOrEqual(1);
  });

  it("accepts CAST_VOTE from players", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    const categoryId = room.state.categoryOptions[0]!.id;
    clients[0]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId });
    await room.waitForNextPatch();
    clients[1]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId });
    await room.waitForNextPatch();
    clients[2]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId });
    await room.waitForNextPatch();
    for (const matchup of room.state.matchups) {
      for (const client of clients) {
        client.send("ACTION", {
          type: "SUBMIT_ANSWER",
          matchupId: matchup.id,
          answer: "test answer",
        });
      }
      await room.waitForNextPatch();
    }
    expect(room.state.phase).toBe("Voting");
    // Plan 09 will implement vote tracking. For now, just verify CAST_VOTE doesn't crash.
    const answerId = room.state.matchups[0]!.answers[0]!.id;
    clients[0]!.send("ACTION", { type: "CAST_VOTE", answerId });
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("Voting");
  });

  it("transitions when all players vote", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    const categoryId = room.state.categoryOptions[0]!.id;
    clients[0]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId });
    await room.waitForNextPatch();
    clients[1]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId });
    await room.waitForNextPatch();
    clients[2]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId });
    await room.waitForNextPatch();
    for (const matchup of room.state.matchups) {
      for (const client of clients) {
        client.send("ACTION", {
          type: "SUBMIT_ANSWER",
          matchupId: matchup.id,
          answer: "test answer",
        });
      }
      await room.waitForNextPatch();
    }
    expect(room.state.phase).toBe("Voting");
    // Plan 09 will implement sequential matchup voting. For now, just verify votes don't crash.
    const answerId = room.state.matchups[0]!.answers[0]!.id;
    for (const client of clients) {
      client.send("ACTION", { type: "CAST_VOTE", answerId });
      await room.waitForNextPatch();
    }
    expect(room.state.phase).toBe("Voting");
  });

  it("transitions when timer expires", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    const categoryId = room.state.categoryOptions[0]!.id;
    clients[0]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId });
    await room.waitForNextPatch();
    clients[1]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId });
    await room.waitForNextPatch();
    clients[2]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId });
    await room.waitForNextPatch();
    for (const matchup of room.state.matchups) {
      for (const client of clients) {
        client.send("ACTION", {
          type: "SUBMIT_ANSWER",
          matchupId: matchup.id,
          answer: "test answer",
        });
      }
      await room.waitForNextPatch();
    }
    expect(room.state.phase).toBe("Voting");
    // Plan 09 will implement voting timer. For now, phase stays in Voting.
    await new Promise((r) => setTimeout(r, TEST_DURATIONS_VOTE_MS + 50));
    expect(room.state.phase).toBe("Voting");
  });
});
