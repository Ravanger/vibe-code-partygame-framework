import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PhaseDurations } from "../../src/rooms/GameRoom.js";
import { bootTestServer, seatPlayers } from "./helpers/harness.js";

const TEST_DURATIONS_PROMPT_MS = 2000;
const DURATIONS: PhaseDurations = {
  categoryVoteMs: 500,
  promptMs: TEST_DURATIONS_PROMPT_MS,
  matchupVoteMs: 60,
  matchupRevealMs: 30,
  emptyRoomGraceMs: 200,
};

describe("GameRoom — Prompting phase", () => {
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

  it("enters Prompting after CategorySelection resolves", async () => {
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
    expect(room.state.selectedCategory).toBe(categoryId);
    expect(room.state.promptText).not.toBe("");
    expect(room.state.phaseEndsAt).toBeGreaterThan(room.state.serverNow);
  });

  it("accepts SUBMIT_ANSWER from players", async () => {
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
    clients[0]!.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: promptId, answer: "My answer" });
    await room.waitForNextPatch();
    expect(room.state.submittedAnswers.get(clients[0]!.sessionId)).toBe("My answer");
  });

  it("transitions when all players submit", async () => {
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
    expect(room.state.phase).toBe("Prompting");
    clients[2]!.send("ACTION", { type: "SUBMIT_ANSWER", matchupId: promptId, answer: "A3" });
    await room.waitForNextPatch();
    expect(room.state.phase).not.toBe("Prompting");
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
    expect(room.state.phase).toBe("Prompting");
    await new Promise((r) => setTimeout(r, TEST_DURATIONS_PROMPT_MS + 50));
    expect(room.state.phase).not.toBe("Prompting");
  });
});
