import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { bootTestServer, seatPlayers, sleep } from "./helpers/harness.js";

const TEST_DURATIONS_CATEGORY_VOTE_MS = 500;

describe("GameRoom — Category Vote phase", () => {
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

  it("deals exactly three options on entering CategorySelection", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    await seatPlayers(colyseus, room, 3);
    expect(room.state.categoryOptions).toHaveLength(3);
  });

  it("deals three distinct categories", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    await seatPlayers(colyseus, room, 3);
    const ids = room.state.categoryOptions.map((o) => o.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("records a vote and increments that option's count", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    const optionId = room.state.categoryOptions[0]!.id;
    clients[0]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: optionId });
    await room.waitForNextPatch();
    expect(room.state.categoryOptions[0]!.votes).toBe(1);
  });

  it("lets a player change their vote without double-counting", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    const opt0 = room.state.categoryOptions[0]!.id;
    const opt1 = room.state.categoryOptions[1]!.id;
    clients[0]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opt0 });
    await room.waitForNextPatch();
    clients[0]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opt1 });
    await room.waitForNextPatch();
    expect(room.state.categoryOptions[0]!.votes).toBe(0);
    expect(room.state.categoryOptions[1]!.votes).toBe(1);
  });

  it("ignores a vote for an unknown categoryId", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    const initialVotes = room.state.categoryOptions.map((o) => o.votes);
    clients[0]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: "unknown-id" });
    await room.waitForNextPatch();
    const finalVotes = room.state.categoryOptions.map((o) => o.votes);
    expect(finalVotes).toEqual(initialVotes);
  });

  it("resolves early once every connected ready player has voted", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    const opts = room.state.categoryOptions;
    clients[0]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]!.id });
    await room.waitForNextPatch();
    clients[1]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]!.id });
    await room.waitForNextPatch();
    clients[2]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]!.id });
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("Prompting");
  });

  it("resolves when the timer expires even if nobody voted", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    await seatPlayers(colyseus, room, 3);
    await sleep(550);
    expect(room.state.phase).toBe("Prompting");
    expect(room.state.selectedCategory).not.toBe("");
  });

  it("ignores a vote that arrives after resolution", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    const opts = room.state.categoryOptions;
    const opt1 = opts[1]!.id;
    clients[0]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]!.id });
    await room.waitForNextPatch();
    clients[1]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]!.id });
    await room.waitForNextPatch();
    clients[2]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]!.id });
    await room.waitForNextPatch();
    clients[0]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opt1 });
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("Prompting");
  });

  it("excludes disconnected players from the all-voted check", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    clients[2]!.leave();
    await room.waitForNextPatch();
    const opts = room.state.categoryOptions;
    clients[0]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]!.id });
    await room.waitForNextPatch();
    clients[1]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]!.id });
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("Prompting");
  });

  it("clears categoryVotes and options when leaving the phase", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    const opts = room.state.categoryOptions;
    clients[0]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]!.id });
    await room.waitForNextPatch();
    clients[1]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]!.id });
    await room.waitForNextPatch();
    clients[2]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]!.id });
    await room.waitForNextPatch();
    expect(room.state.categoryVotes.size).toBe(0);
    expect(room.state.categoryOptions.length).toBe(0);
  });

  it("does not resolve twice when the last vote and the timer race", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    const opts = room.state.categoryOptions;
    clients[0]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]!.id });
    await room.waitForNextPatch();
    clients[1]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]!.id });
    await room.waitForNextPatch();
    clients[2]!.send("ACTION", { type: "VOTE_CATEGORY", categoryId: opts[0]!.id });
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("Prompting");
    await sleep(TEST_DURATIONS_CATEGORY_VOTE_MS + 50);
    expect(room.state.phase).toBe("Prompting");
  });

  it("sets phaseEndsAt about 60s ahead", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    await seatPlayers(colyseus, room, 3);
    const diff = room.state.phaseEndsAt - room.state.serverNow;
    expect(diff).toBeGreaterThanOrEqual(TEST_DURATIONS_CATEGORY_VOTE_MS - 50);
    expect(diff).toBeLessThanOrEqual(TEST_DURATIONS_CATEGORY_VOTE_MS + 50);
  });
});
