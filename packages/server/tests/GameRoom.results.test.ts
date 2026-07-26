import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PhaseDurations } from "../../src/rooms/GameRoom.js";
import { bootTestServer, seatPlayers } from "./helpers/harness.js";

const DURATIONS: PhaseDurations = {
  categoryVoteMs: 500,
  promptMs: 2000,
  matchupVoteMs: 2000,
  matchupRevealMs: 200,
  emptyRoomGraceMs: 200,
};

describe("GameRoom — Results phase", () => {
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

  it("enters Results after Voting resolves", async () => {
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
    const answerId = room.state.matchups[0]!.answerAId;
    clients[0]!.send("ACTION", { type: "CAST_VOTE", answerId });
    await room.waitForNextPatch();
    clients[1]!.send("ACTION", { type: "CAST_VOTE", answerId });
    await room.waitForNextPatch();
    clients[2]!.send("ACTION", { type: "CAST_VOTE", answerId });
    await room.waitForNextPatch();
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("Results");
  });

  it("calculates scores from matchup results", async () => {
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
    const answerAId = room.state.matchups[0]!.answerAId;
    clients[0]!.send("ACTION", { type: "CAST_VOTE", answerId: answerAId });
    await room.waitForNextPatch();
    clients[1]!.send("ACTION", { type: "CAST_VOTE", answerId: answerAId });
    await room.waitForNextPatch();
    clients[2]!.send("ACTION", { type: "CAST_VOTE", answerId: answerAId });
    await room.waitForNextPatch();
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("Results");
    expect(room.state.scores.get(answerAId)).toBe(1);
  });

  it("starts next round after reveal timer", async () => {
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
    const answerId = room.state.matchups[0]!.answerAId;
    clients[0]!.send("ACTION", { type: "CAST_VOTE", answerId });
    await room.waitForNextPatch();
    clients[1]!.send("ACTION", { type: "CAST_VOTE", answerId });
    await room.waitForNextPatch();
    clients[2]!.send("ACTION", { type: "CAST_VOTE", answerId });
    await room.waitForNextPatch();
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("Results");
    expect(room.state.round).toBe(1);
    await new Promise((r) => setTimeout(r, DURATIONS.matchupRevealMs + 50));
    expect(room.state.phase).toBe("CategorySelection");
    expect(room.state.round).toBe(2);
  });
});
