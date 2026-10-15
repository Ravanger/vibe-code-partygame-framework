import { type ActionResult, CLIENT_MESSAGES, CLOSE_CODES, ClientMessage } from "@partygame/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { TestServer } from "../src/testing/index.js";
import { collectMessages, waitUntil } from "../src/testing/index.js";
import { bootBuzzer, clientState, pid, seat, startedRoom, stateOf } from "./support.js";

let t: TestServer;
beforeAll(async () => {
  t = await bootBuzzer();
});
afterEach(() => t.cleanup());
afterAll(() => t.shutdown());

describe("GameRoom actions", () => {
  it("dispatches an action to the game and finishes when everyone has acted", async () => {
    const { room, p1, p2 } = await startedRoom(t);
    p2.client.send("ACTION", { type: "BUZZ" });
    await waitUntil(() => stateOf(room).winner === pid(2), "winner");
    p1.client.send("ACTION", { type: "BUZZ" });
    await waitUntil(() => stateOf(room).phase === "Done", "done");
    expect(stateOf(room).buzzCount).toBe(2);
    expect(stateOf(room).phaseEndsAt).toBe(0);
  });

  it("broadcasts game messages to every client and gives the game a random source", async () => {
    const { room, p1, p2 } = await startedRoom(t);
    const heard1 = collectMessages(p1.client, "FIRST");
    const heard2 = collectMessages(p2.client, "FIRST");
    p2.client.send("ACTION", { type: "BUZZ" });
    await waitUntil(() => heard1.length === 1 && heard2.length === 1, "both heard it");
    expect(heard1[0]).toEqual({ playerId: pid(2) });
    expect(stateOf(room).lucky).toBeGreaterThanOrEqual(0);
    expect(stateOf(room).lucky).toBeLessThan(1000);
  });

  it("sends every rejection to the sender only", async () => {
    const room = await t.createRoom("buzzer");
    const p1 = await seat(t, room, 1);
    const p2 = await t.join(room, { playerId: pid(2) });
    p1.client.send("ACTION", { type: "BUZZ" });
    p1.client.send("ACTION", { type: "NOPE" });
    p1.client.send("ACTION", { type: "lower" });
    p1.client.send("ACTION", { type: "START_GAME" });
    await waitUntil(() => p1.errors.length === 4, "four errors");
    expect(p1.errors).toEqual([
      { code: "WRONG_PHASE", message: CLIENT_MESSAGES.WRONG_PHASE },
      { code: "UNKNOWN_ACTION", message: CLIENT_MESSAGES.UNKNOWN_ACTION },
      { code: "INVALID_ACTION", message: CLIENT_MESSAGES.INVALID_ACTION },
      { code: "NOT_ENOUGH_PLAYERS", message: CLIENT_MESSAGES.NOT_ENOUGH_PLAYERS },
    ]);
    const guestErrors: unknown[] = [];
    p2.onMessage("ERROR", (e: unknown) => guestErrors.push(e));
    p2.send("ACTION", { type: "START_GAME" });
    await waitUntil(() => guestErrors.length === 1, "unauthorized");
    expect(guestErrors[0]).toEqual({ code: "UNAUTHORIZED", message: CLIENT_MESSAGES.UNAUTHORIZED });
  });

  it("lets the host start manually", async () => {
    const room = await t.createRoom("buzzer");
    const p1 = await seat(t, room, 1);
    await t.join(room, { playerId: pid(2) });
    await seat(t, room, 2).catch(() => undefined);
    p1.client.send("ACTION", { type: "START_GAME" });
    await waitUntil(() => stateOf(room).phase === "Buzz", "started");
  });

  it("survives a throwing action handler and returns to the Lobby", async () => {
    const { room, p1 } = await startedRoom(t);
    p1.client.send("ACTION", { type: "BOOM" });
    // The default failure policy returns the room to the Lobby with a notice.
    await waitUntil(() => stateOf(room).phase === "Lobby", "back in the Lobby");
    expect(stateOf(room).notice).toBeTruthy();
    // The host can start again and the room still handles actions.
    p1.client.send("ACTION", { type: "START_GAME" });
    await waitUntil(() => stateOf(room).phase === "Buzz", "restarted");
    p1.client.send("ACTION", { type: "BUZZ" });
    await waitUntil(() => stateOf(room).winner === pid(1), "room still handles actions");
  });

  it("survives a throwing timeout hook and returns to the Lobby", async () => {
    const { room } = await startedRoom(t, { buzzMs: 60, explodeOnTimeout: true });
    // The exploding timeout no longer wedges the room in Buzz; it ends in the Lobby with a notice.
    await waitUntil(() => stateOf(room).phase === "Lobby", "back in the Lobby");
    expect(stateOf(room).notice).toBeTruthy();
  });
});

describe("GameRoom action requests", () => {
  it("answers an accepted action with ok", async () => {
    const { room, p2 } = await startedRoom(t);
    const result = await p2.client.request<unknown, ActionResult>(ClientMessage.ACTION, {
      type: "BUZZ",
    });
    expect(result).toEqual({ ok: true });
    expect(stateOf(room).winner).toBe(pid(2));
  });

  it("answers a rejected action with its error, and still pushes ERROR", async () => {
    const room = await t.createRoom("buzzer");
    const p1 = await seat(t, room, 1);
    const result = await p1.client.request<unknown, ActionResult>(ClientMessage.ACTION, {
      type: "BUZZ",
    });
    const error = { code: "WRONG_PHASE", message: CLIENT_MESSAGES.WRONG_PHASE };
    expect(result).toEqual({ ok: false, error });
    await waitUntil(() => p1.errors.length === 1, "pushed ERROR");
    expect(p1.errors[0]).toEqual(error);
  });

  it("rejects a spectator's request like a spectator's send", async () => {
    const room = await t.createRoom("buzzer");
    const watcher = await t.join(room, { playerId: pid(9), spectator: true });
    const result = await watcher.request<unknown, ActionResult>(ClientMessage.ACTION, {
      type: "BUZZ",
    });
    expect(result).toEqual({
      ok: false,
      error: { code: "UNAUTHORIZED", message: CLIENT_MESSAGES.UNAUTHORIZED },
    });
  });

  it("answers INTERNAL with the fixed message when the action handler throws, returns to the Lobby and keeps serving", async () => {
    const { room, p1 } = await startedRoom(t);
    const failed = await p1.client.request<unknown, ActionResult>(ClientMessage.ACTION, {
      type: "BOOM",
    });
    expect(failed).toEqual({
      ok: false,
      error: { code: "INTERNAL", message: CLIENT_MESSAGES.INTERNAL },
    });
    expect(stateOf(room).phase).toBe("Lobby");
    const notice = stateOf(room).notice;
    expect(notice).toBeTruthy();
    // The exception text ("boom") must never reach a client.
    expect(notice).not.toContain("boom");
    for (const error of p1.errors) expect(JSON.stringify(error)).not.toContain("boom");
    await p1.client.request(ClientMessage.ACTION, { type: "START_GAME" });
    await waitUntil(() => stateOf(room).phase === "Buzz", "restarted");
    await p1.client.request(ClientMessage.ACTION, { type: "BUZZ" });
    expect(stateOf(room).winner).toBe(pid(1));
  });
});

describe("GameRoom timers and clock", () => {
  it("runs the phase timer on the room clock", async () => {
    const { room } = await startedRoom(t, { buzzMs: 60 });
    await waitUntil(() => stateOf(room).phase === "Done", "timed out");
  });

  it("ticks serverNow", async () => {
    const room = await t.createRoom("buzzer");
    stateOf(room).serverNow = 0;
    await waitUntil(() => stateOf(room).serverNow > 0, "tick", 2500);
  });
});

describe("GameRoom host controls", () => {
  it("publishes SET_OPTIONS to every client and rejects invalid ones", async () => {
    const room = await t.createRoom("buzzer");
    const p1 = await seat(t, room, 1);
    p1.client.send("ACTION", { type: "SET_OPTIONS", buzzMs: 4321 });
    await waitUntil(
      () => JSON.parse(clientState(p1.client).options ?? "{}").buzzMs === 4321,
      "published",
    );
    p1.client.send("ACTION", { type: "SET_OPTIONS", buzzMs: "x" });
    await waitUntil(() => p1.errors.length === 1, "invalid option");
    expect(p1.errors[0]).toEqual({
      code: "INVALID_ACTION",
      message: CLIENT_MESSAGES.INVALID_ACTION,
      action: "SET_OPTIONS",
    });
    expect(JSON.parse(stateOf(room).options).buzzMs).toBe(4321);
  });

  it("kicks a connected player: KICKED error, seat gone, connection closed", async () => {
    const { room, p1, p2 } = await startedRoom(t);
    p1.client.send("ACTION", { type: "KICK_PLAYER", playerId: pid(2) });
    await waitUntil(() => p2.errors.length === 1, "kicked");
    expect(p2.errors[0]).toEqual({ code: "KICKED", message: CLIENT_MESSAGES.KICKED });
    await waitUntil(() => !stateOf(room).players.has(pid(2)), "seat removed");
    await waitUntil(() => room.clients.length === 1, "connection closed");
  });

  it("bans a kicked player for the room's lifetime, as a player or a spectator", async () => {
    const { room, p1, p2 } = await startedRoom(t);
    p1.client.send("ACTION", { type: "KICK_PLAYER", playerId: pid(2) });
    await waitUntil(() => p2.errors.length === 1, "kicked");
    await waitUntil(() => !stateOf(room).players.has(pid(2)), "seat removed");
    await expect(t.join(room, { playerId: pid(2) })).rejects.toMatchObject({
      code: CLOSE_CODES.KICKED_REJOIN.code,
      message: CLOSE_CODES.KICKED_REJOIN.message,
    });
    await expect(t.join(room, { playerId: pid(2), spectator: true })).rejects.toMatchObject({
      code: CLOSE_CODES.KICKED_REJOIN.code,
      message: CLOSE_CODES.KICKED_REJOIN.message,
    });
    expect(stateOf(room).players.has(pid(2))).toBe(false);
    const other = await t.join(room, { playerId: pid(3) });
    expect(other.sessionId).toBeTruthy();
  });

  it("kicks a disconnected player", async () => {
    const { room, p1, p2 } = await startedRoom(t);
    await p2.client.leave(false);
    await waitUntil(() => stateOf(room).players.get(pid(2))?.isConnected === false, "dropped");
    p1.client.send("ACTION", { type: "KICK_PLAYER", playerId: pid(2) });
    await waitUntil(() => !stateOf(room).players.has(pid(2)), "seat removed");
  });
});

describe("GameRoom views", () => {
  it("shows each player only their own .view() entry and hides it again", async () => {
    const { room, p1, p2 } = await startedRoom(t);
    await waitUntil(() => clientState(p1.client).secrets?.size === 1, "p1 secret");
    await waitUntil(() => clientState(p2.client).secrets?.size === 1, "p2 secret");
    expect([...clientState(p1.client).secrets.keys()]).toEqual([pid(1)]);
    expect([...clientState(p2.client).secrets.keys()]).toEqual([pid(2)]);
    expect(clientState(p1.client).secrets.get(pid(1))?.word).toBe(`secret-${pid(1)}`);
    p1.client.send("ACTION", { type: "BUZZ" });
    p2.client.send("ACTION", { type: "BUZZ" });
    await waitUntil(() => stateOf(room).phase === "Done", "done");
    p1.client.send("ACTION", { type: "RESET" });
    await waitUntil(() => stateOf(room).phase === "Lobby", "lobby");
    await waitUntil(() => clientState(p1.client).secrets.size === 0, "secrets cleared");
  });

  it("does not auto-start again after returning to the lobby", async () => {
    const { room, p1, p2 } = await startedRoom(t);
    p1.client.send("ACTION", { type: "BUZZ" });
    p2.client.send("ACTION", { type: "BUZZ" });
    await waitUntil(() => stateOf(room).phase === "Done", "done");
    p1.client.send("ACTION", { type: "RESET" });
    await waitUntil(() => stateOf(room).phase === "Lobby", "lobby");
    p2.client.send("SET_NAME", "Again");
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(stateOf(room).phase).toBe("Lobby");
    p1.client.send("ACTION", { type: "START_GAME" });
    await waitUntil(() => stateOf(room).phase === "Buzz", "manual start");
  });
});
