import type { Room } from "@colyseus/core";
import { ACTION_NAME_PATTERN, CLIENT_MESSAGES, ErrorCode } from "@partygame/shared";
import { afterEach, describe, expect, it } from "vitest";
import { collectMessages, type TestServer, waitUntil } from "../src/testing/index.js";
import { bootBuzzer, pid, seat, startedRoom, stateOf } from "./support.js";

let t: TestServer | undefined;
afterEach(async () => {
  await t?.shutdown();
  t = undefined;
});

/** A stable JSON view of the room state; excludes fields that move on ticks and connections. */
const snapshot = (room: Room): string => {
  const s = stateOf(room);
  const players = [...s.players.values()]
    .map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      isReady: p.isReady,
      isConnected: p.isConnected,
      isActive: p.isActive,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify({
    phase: s.phase,
    options: s.options,
    players,
    winner: s.winner,
    buzzCount: s.buzzCount,
    lucky: s.lucky,
  });
};

/** Asserts the exact client-visible rejection for `code` (with `action` when the pipeline names one). */
const expectRejected = (error: unknown, code: ErrorCode, action?: string): void => {
  expect(error).toEqual({
    code,
    message: CLIENT_MESSAGES[code],
    ...(action !== undefined ? { action } : {}),
  });
};

/** Waits for the nth ERROR a client has been collecting and returns it. */
const nthError = async (errors: unknown[], n: number): Promise<unknown> => {
  await waitUntil(() => errors.length >= n, `ERROR ${n}`);
  return errors[n - 1];
};

/** Opens a raw WebSocket to `url`, sends one binary frame of `size` bytes, and resolves with the server's close code. */
const rawFrameCloseCode = (url: string, size: number): Promise<number> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(
      () => reject(new Error(`raw frame to ${url} did not close within 3s`)),
      3000,
    );
    socket.onopen = () => {
      socket.send(new Uint8Array(size));
    };
    socket.onclose = (event) => {
      clearTimeout(timer);
      resolve(event.code);
    };
  });

describe("hostile payloads", () => {
  it("rejects a KICK_PLAYER whose playerId has the wrong type and leaves state untouched", async () => {
    t = await bootBuzzer();
    const { room, p1 } = await startedRoom(t);
    const before = snapshot(room);
    p1.client.send("ACTION", { type: "KICK_PLAYER", playerId: 42 });
    expectRejected(await nthError(p1.errors, 1), ErrorCode.INVALID_ACTION, "KICK_PLAYER");
    expect(snapshot(room)).toBe(before);
  });

  it("rejects a KICK_PLAYER with no payload fields and leaves state untouched", async () => {
    t = await bootBuzzer();
    const { room, p1 } = await startedRoom(t);
    const before = snapshot(room);
    p1.client.send("ACTION", { type: "KICK_PLAYER" });
    expectRejected(await nthError(p1.errors, 1), ErrorCode.INVALID_ACTION, "KICK_PLAYER");
    expect(snapshot(room)).toBe(before);
  });

  it("rejects a SET_OPTIONS value that fails the options schema and leaves state untouched", async () => {
    t = await bootBuzzer();
    const room = await t.createRoom("buzzer");
    const p1 = await seat(t, room, 1);
    await waitUntil(() => stateOf(room).players.get(pid(1))?.isReady === true, "p1 ready");
    const before = snapshot(room);
    p1.client.send("ACTION", { type: "SET_OPTIONS", buzzMs: "x" });
    expectRejected(await nthError(p1.errors, 1), ErrorCode.INVALID_ACTION, "SET_OPTIONS");
    expect(snapshot(room)).toBe(before);
  });
});

describe("hostile envelopes", () => {
  it("closes an oversized raw frame with 1009 and leaves the room untouched", async () => {
    t = await bootBuzzer();
    const { room, p1 } = await startedRoom(t);
    const before = snapshot(room);
    expect(await rawFrameCloseCode(`${t.endpoint}/buzzer`, 5_000)).toBe(1009);
    expect(snapshot(room)).toBe(before);
    // the room still accepts actions from its players
    p1.client.send("ACTION", { type: "BUZZ" });
    await waitUntil(() => stateOf(room).buzzCount === 1, "p1 could still buzz");
  });

  it("rejects an action name no phase declares with UNKNOWN_ACTION", async () => {
    t = await bootBuzzer();
    const { room, p1 } = await startedRoom(t);
    const before = snapshot(room);
    p1.client.send("ACTION", { type: "NOPE_NOPE" });
    expectRejected(await nthError(p1.errors, 1), ErrorCode.UNKNOWN_ACTION);
    expect(snapshot(room)).toBe(before);
  });

  it("rejects every action name that fails the pattern with INVALID_ACTION and no action", async () => {
    const names = ["lowercase", "", "WITH SPACE", "9STARTS_WITH_DIGIT", "X".repeat(65)];
    for (const name of names) expect(ACTION_NAME_PATTERN.test(name)).toBe(false);
    t = await bootBuzzer();
    const { room, p1 } = await startedRoom(t);
    const before = snapshot(room);
    for (const name of names) p1.client.send("ACTION", { type: name });
    for (let i = 1; i <= names.length; ++i) {
      expectRejected(await nthError(p1.errors, i), ErrorCode.INVALID_ACTION);
    }
    expect(snapshot(room)).toBe(before);
  });

  it("rejects every non-object envelope with INVALID_ACTION and no action", async () => {
    const envelopes: unknown[] = [null, [1, 2], "BUZZ", 42];
    t = await bootBuzzer();
    const { room, p1 } = await startedRoom(t);
    const before = snapshot(room);
    for (const envelope of envelopes) p1.client.send("ACTION", envelope);
    for (let i = 1; i <= envelopes.length; ++i) {
      expectRejected(await nthError(p1.errors, i), ErrorCode.INVALID_ACTION);
    }
    expect(snapshot(room)).toBe(before);
  });
});

describe("hostile authorization", () => {
  it("rejects a spectator's action with UNAUTHORIZED and no action", async () => {
    t = await bootBuzzer();
    const { room } = await startedRoom(t);
    const before = snapshot(room);
    const spec = await t.join(room, { playerId: "spectator-0001", spectator: true });
    const errors = collectMessages(spec, "ERROR");
    spec.send("ACTION", { type: "BUZZ" });
    expectRejected(await nthError(errors, 1), ErrorCode.UNAUTHORIZED);
    expect(snapshot(room)).toBe(before);
  });

  it("rejects a KICK_PLAYER from a non-host with UNAUTHORIZED and keeps the target seated", async () => {
    t = await bootBuzzer();
    const { room, p2 } = await startedRoom(t);
    const before = snapshot(room);
    p2.client.send("ACTION", { type: "KICK_PLAYER", playerId: pid(1) });
    expectRejected(await nthError(p2.errors, 1), ErrorCode.UNAUTHORIZED);
    expect(snapshot(room)).toBe(before);
  });

  it("rejects a RESET from a non-host in Done with UNAUTHORIZED and stays in Done", async () => {
    t = await bootBuzzer();
    const { room, p1, p2 } = await startedRoom(t);
    p1.client.send("ACTION", { type: "BUZZ" });
    p2.client.send("ACTION", { type: "BUZZ" });
    await waitUntil(() => stateOf(room).phase === "Done", "game done");
    const before = snapshot(room);
    p2.client.send("ACTION", { type: "RESET" });
    expectRejected(await nthError(p2.errors, 1), ErrorCode.UNAUTHORIZED);
    expect(snapshot(room)).toBe(before);
  });

  it("rejects a RESET in Buzz with WRONG_PHASE and stays in Buzz", async () => {
    t = await bootBuzzer();
    const { room, p1 } = await startedRoom(t);
    const before = snapshot(room);
    p1.client.send("ACTION", { type: "RESET" });
    expectRejected(await nthError(p1.errors, 1), ErrorCode.WRONG_PHASE);
    expect(snapshot(room)).toBe(before);
  });
});
