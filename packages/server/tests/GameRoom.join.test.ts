import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { collectMessages, type TestServer, waitUntil } from "../src/testing/index.js";
import { bootBuzzer, clientState, pid, seat, stateOf } from "./support.js";

let t: TestServer;
beforeAll(async () => {
  t = await bootBuzzer();
});
afterEach(() => t.cleanup());
afterAll(() => t.shutdown());

describe("GameRoom joining", () => {
  it("publishes the room metadata and seats the first player as host", async () => {
    const room = await t.createRoom("buzzer", { buzzMs: 5000, playerId: "ignored", name: "x" });
    const client = await t.join(room, { playerId: pid(1), name: "Ann" });
    await waitUntil(() => clientState(client).players?.get(pid(1)) !== undefined, "seat synced");
    const state = stateOf(room);
    const seatOne = state.players.get(pid(1));
    expect(seatOne).toMatchObject({
      id: pid(1),
      name: "Ann",
      role: "host",
      isReady: false,
      isConnected: true,
      isActive: true,
    });
    expect(state.roomCode).toMatch(/^[A-Z]{4}$/);
    expect(t.roomCodeService.resolve(state.roomCode)).toBe(room.roomId);
    expect([state.minPlayers, state.maxPlayers]).toEqual([2, 3]);
    expect(JSON.parse(state.options)).toEqual({ buzzMs: 5000, explodeOnTimeout: false });
    expect(clientState(client).roomCode).toBe(state.roomCode);
  });

  it("seats later players as guests with an empty name by default", async () => {
    const room = await t.createRoom("buzzer");
    await t.join(room, { playerId: pid(1) });
    await t.join(room, { playerId: pid(2) });
    expect(stateOf(room).players.get(pid(2))).toMatchObject({ role: "player", name: "" });
  });

  it.each([{}, { playerId: "short" }, { playerId: pid(1), spectator: "yes" }])(
    "rejects invalid join options %j",
    async (options) => {
      const room = await t.createRoom("buzzer");
      await expect(t.sdk.joinById(room.roomId, options)).rejects.toThrow();
      expect(stateOf(room).players.size).toBe(0);
    },
  );

  it("rejects a player past maxPlayers but still admits spectators", async () => {
    const room = await t.createRoom("buzzer");
    for (const n of [1, 2, 3]) await t.join(room, { playerId: pid(n) });
    await expect(t.join(room, { playerId: pid(4) })).rejects.toThrow();
    expect(stateOf(room).players.size).toBe(3);
    await t.join(room, { playerId: pid(5), spectator: true });
    expect(stateOf(room).spectatorCount).toBe(1);
  });

  it("seats a mid-game joiner as inactive and rejects their actions", async () => {
    const room = await t.createRoom("buzzer");
    await seat(t, room, 1);
    await seat(t, room, 2);
    await waitUntil(() => stateOf(room).phase === "Buzz", "started");
    const late = await seat(t, room, 3);
    await waitUntil(() => stateOf(room).players.get(pid(3))?.isReady === true, "late ready");
    expect(stateOf(room).players.get(pid(3))?.isActive).toBe(false);
    late.client.send("ACTION", { type: "BUZZ" });
    await waitUntil(() => late.errors.length > 0, "NOT_ACTIVE");
    expect(late.errors[0]).toMatchObject({ code: "NOT_ACTIVE", action: "BUZZ" });
  });
});

describe("GameRoom activation", () => {
  it("benches a lobby joiner without a name when the game starts", async () => {
    const room = await t.createRoom("buzzer");
    const p1 = await seat(t, room, 1);
    await t.join(room, { playerId: pid(3) });
    await waitUntil(() => stateOf(room).players.get(pid(3))?.isActive === true, "lobby joiner");
    const p2 = await seat(t, room, 2);
    await waitUntil(() => stateOf(room).players.get(pid(2))?.isReady === true, "p2 ready");
    p1.client.send("ACTION", { type: "START_GAME" });
    await waitUntil(() => stateOf(room).phase === "Buzz", "started");
    expect(stateOf(room).players.get(pid(3))?.isActive).toBe(false);
    expect(stateOf(room).players.get(pid(2))?.isActive).toBe(true);
    expect(p2.errors).toEqual([]);
  });

  it("keeps an unnamed seat waiting after a round and activates it once it has a name", async () => {
    const room = await t.createRoom("buzzer");
    const p1 = await seat(t, room, 1);
    const p2 = await seat(t, room, 2);
    await waitUntil(() => stateOf(room).phase === "Buzz", "started");
    const late = await t.join(room, { playerId: pid(3) });
    await waitUntil(() => stateOf(room).players.has(pid(3)), "seated");
    expect(stateOf(room).players.get(pid(3))?.isActive).toBe(false);
    p1.client.send("ACTION", { type: "BUZZ" });
    p2.client.send("ACTION", { type: "BUZZ" });
    await waitUntil(() => stateOf(room).phase === "Done", "done");
    p1.client.send("ACTION", { type: "RESET" });
    await waitUntil(() => stateOf(room).phase === "Lobby", "lobby");
    expect(stateOf(room).players.get(pid(3))?.isActive).toBe(false);
    late.send("SET_NAME", "P3");
    await waitUntil(() => stateOf(room).players.get(pid(3))?.isActive === true, "activated");
  });
});

describe("GameRoom spectators", () => {
  it("counts spectators without seating them and refuses their messages", async () => {
    const room = await t.createRoom("buzzer");
    const tv = await t.join(room, { playerId: pid(9), spectator: true });
    const errors = collectMessages(tv, "ERROR");
    await waitUntil(() => stateOf(room).spectatorCount === 1, "counted");
    expect(stateOf(room).players.size).toBe(0);
    tv.send("SET_NAME", "TV");
    tv.send("ACTION", { type: "START_GAME" });
    await waitUntil(() => errors.length === 2, "two refusals");
    expect(errors).toEqual([
      { code: "UNAUTHORIZED", message: expect.any(String) },
      { code: "UNAUTHORIZED", message: expect.any(String) },
    ]);
    await tv.leave(true);
    await waitUntil(() => stateOf(room).spectatorCount === 0, "uncounted");
  });

  it("does not count spectators towards auto-start", async () => {
    const room = await t.createRoom("buzzer");
    await t.join(room, { playerId: pid(9), spectator: true });
    await seat(t, room, 1);
    await seat(t, room, 2);
    await waitUntil(() => stateOf(room).phase === "Buzz", "started");
  });
});

describe("GameRoom SET_NAME", () => {
  it("trims the name, marks the seat ready and rejects invalid names", async () => {
    const room = await t.createRoom("buzzer");
    const client = await t.join(room, { playerId: pid(1) });
    const errors = collectMessages(client, "ERROR");
    client.send("SET_NAME", "   ");
    await waitUntil(() => errors.length === 1, "invalid name");
    expect(errors[0]).toMatchObject({ code: "INVALID_ACTION" });
    expect(stateOf(room).players.get(pid(1))?.isReady).toBe(false);
    client.send("SET_NAME", "  Ann  ");
    await waitUntil(() => stateOf(room).players.get(pid(1))?.isReady === true, "ready");
    expect(stateOf(room).players.get(pid(1))?.name).toBe("Ann");
  });

  it("rejects a name another seat has, ignoring case and spacing, but allows re-setting your own", async () => {
    const room = await t.createRoom("buzzer");
    const ann = await t.join(room, { playerId: pid(1), name: "Ann" });
    const bob = await t.join(room, { playerId: pid(2) });
    const errors = collectMessages(bob, "ERROR");
    bob.send("SET_NAME", "  aNN ");
    await waitUntil(() => errors.length === 1, "name taken");
    expect(errors[0]).toEqual({ code: "NAME_TAKEN", message: "That name is already taken" });
    expect(stateOf(room).players.get(pid(2))).toMatchObject({ name: "", isReady: false });
    const own = collectMessages(ann, "ERROR");
    ann.send("SET_NAME", "ANN");
    await waitUntil(() => stateOf(room).players.get(pid(1))?.name === "ANN", "own rename");
    expect(own).toEqual([]);
  });

  it("seats a joiner unnamed when the join name is taken", async () => {
    const room = await t.createRoom("buzzer");
    await t.join(room, { playerId: pid(1), name: "Ann" });
    await t.join(room, { playerId: pid(2), name: " ann " });
    expect(stateOf(room).players.get(pid(2))?.name).toBe("");
  });

  it("auto-starts once every seat is ready and the minimum is met", async () => {
    const room = await t.createRoom("buzzer");
    await seat(t, room, 1);
    const second = await t.join(room, { playerId: pid(2) });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(stateOf(room).phase).toBe("Lobby");
    second.send("SET_NAME", "P2");
    await waitUntil(() => stateOf(room).phase === "Buzz", "started");
    expect(stateOf(room).phaseEndsAt).toBeGreaterThan(Date.now());
  });
});
