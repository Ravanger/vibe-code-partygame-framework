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
    const promptId = room.state.promptId;
    clients[0]!.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: promptId, answer: "A1" });
    await room.waitForNextPatch();
    clients[1]!.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: promptId, answer: "A2" });
    await room.waitForNextPatch();
    clients[2]!.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: promptId, answer: "A3" });
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("Voting");
    expect(room.state.matchups.length).toBeGreaterThanOrEqual(1);
    expect(room.state.phaseEndsAt).toBeGreaterThan(room.state.serverNow);
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
    const promptId = room.state.promptId;
    clients[0]!.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: promptId, answer: "A1" });
    await room.waitForNextPatch();
    clients[1]!.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: promptId, answer: "A2" });
    await room.waitForNextPatch();
    clients[2]!.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: promptId, answer: "A3" });
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("Voting");
    const answerId = room.state.matchups[0]!.answerAId;
    clients[0]!.send("ACTION", { type: "CAST_VOTE", answerId });
    await room.waitForNextPatch();
    expect(room.state.playerVotes.get(clients[0]!.sessionId)).toBe(answerId);
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
    const promptId = room.state.promptId;
    clients[0]!.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: promptId, answer: "A1" });
    await room.waitForNextPatch();
    clients[1]!.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: promptId, answer: "A2" });
    await room.waitForNextPatch();
    clients[2]!.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: promptId, answer: "A3" });
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("Voting");
    const answerId = room.state.matchups[0]!.answerAId;
    clients[0]!.send("ACTION", { type: "CAST_VOTE", answerId });
    await room.waitForNextPatch();
    clients[1]!.send("ACTION", { type: "CAST_VOTE", answerId });
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("Voting");
    clients[2]!.send("ACTION", { type: "CAST_VOTE", answerId });
    await room.waitForNextPatch();
    expect(room.state.phase).not.toBe("Voting");
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
    const promptId = room.state.promptId;
    clients[0]!.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: promptId, answer: "A1" });
    await room.waitForNextPatch();
    clients[1]!.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: promptId, answer: "A2" });
    await room.waitForNextPatch();
    clients[2]!.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: promptId, answer: "A3" });
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("Voting");
    await new Promise((r) => setTimeout(r, TEST_DURATIONS_VOTE_MS + 50));
    expect(room.state.phase).not.toBe("Voting");
  });
});
