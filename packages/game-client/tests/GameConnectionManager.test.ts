import { Client } from "@colyseus/sdk";
import { RoomCodeError } from "@partygame/client-utils";
import {
  CLIENT_MESSAGES,
  CLOSE_CODES,
  ClientMessage,
  ErrorCode,
  PROTOCOL_VERSION,
} from "@partygame/shared";
import { BaseGameState, PlayerSchema } from "@partygame/shared/schema";
import { flushSync } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameConnectionManager } from "../src/GameConnectionManager.svelte.js";
import { fakeFetch, StubRoom } from "../src/testing.js";
import { observe } from "./observe.svelte.js";

let counter = 0;
const stubFetchReply = (reply: unknown) => {
  const stub = fakeFetch(reply);
  vi.stubGlobal("fetch", stub.fetch);
  return stub;
};
const newManager = () =>
  new GameConnectionManager({
    endpoint: "ws://localhost:2567",
    roomName: "stub",
    storagePrefix: `unit${++counter}`,
  });

function seated(manager: GameConnectionManager, role: "host" | "player" = "player") {
  const state = new BaseGameState();
  state.roomCode = "ABCD";
  const seat = new PlayerSchema();
  seat.id = manager.playerId;
  seat.role = role;
  state.players.set(manager.playerId, seat);
  return { state, seat, room: new StubRoom(state) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve));

function watchUnhandled(): { seen: unknown[]; stop: () => void } {
  const seen: unknown[] = [];
  const handler = (reason: unknown): void => {
    seen.push(reason);
  };
  process.on("unhandledRejection", handler);
  return {
    seen,
    stop: () => process.off("unhandledRejection", handler),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("before a room", () => {
  it("is idle, has a stable player id, and no state", () => {
    const manager = newManager();
    expect(manager.status).toBe("idle");
    expect(manager.playerId).toMatch(/^[0-9a-f-]{36}$/);
    expect(manager.state).toBeUndefined();
    expect(manager.roomCode).toBeUndefined();
    expect(manager.me()).toBeUndefined();
    expect(manager.isHost).toBe(false);
  });

  it("refuses an action and a malformed join code", async () => {
    const manager = newManager();
    const result = await manager.sendAction("PRESS");
    expect(result).toEqual({
      ok: false,
      error: { code: ErrorCode.NOT_CONNECTED, message: CLIENT_MESSAGES.NOT_CONNECTED },
    });
    expect(manager.lastServerError?.message).toBe(CLIENT_MESSAGES.NOT_CONNECTED);
    await expect(manager.join("no1")).rejects.toThrow("4 letters");
    manager.setName("ignored");
  });
});

describe("attached to a room", () => {
  it("exposes the state, the code and my seat", () => {
    const manager = newManager();
    const { state, seat, room } = seated(manager, "host");
    manager.attach(room);
    expect(manager.status).toBe("connected");
    expect(manager.state).toBe(state);
    expect(manager.roomCode).toBe("ABCD");
    expect(manager.me()).toBe(seat);
    expect(manager.isHost).toBe(true);
  });

  it("is not host when seated as a player or not seated", () => {
    const manager = newManager();
    manager.attach(seated(manager).room);
    expect(manager.isHost).toBe(false);
    const spectator = newManager();
    spectator.attach(new StubRoom(new BaseGameState()));
    expect(spectator.me()).toBeUndefined();
    expect(spectator.roomCode).toBeUndefined();
  });

  it("is a spectator only while in a room without a seat", () => {
    const manager = newManager();
    expect(manager.isSpectator).toBe(false);
    const { room } = seated(manager);
    manager.attach(room);
    expect(manager.isSpectator).toBe(false);
    const tv = newManager();
    tv.attach(new StubRoom(new BaseGameState()));
    expect(tv.isSpectator).toBe(true);
    tv.dispose();
    expect(tv.isSpectator).toBe(false);
  });

  it("sends SET_NAME", () => {
    const manager = newManager();
    const { room } = seated(manager);
    manager.attach(room);
    manager.setName("Ada");
    expect(room.sent).toEqual([{ type: "SET_NAME", payload: "Ada" }]);
  });

  it("joining the room it is already in does nothing", async () => {
    const manager = newManager();
    const { room } = seated(manager);
    manager.attach(room);
    await manager.join(" abcd ");
    expect(manager.status).toBe("connected");
  });
});

describe("reactivity", () => {
  it("re-runs readers on every patch, even though the state object is the same", () => {
    const manager = newManager();
    const { state, seat, room } = seated(manager);
    manager.attach(room);
    const phases = observe(() => manager.state?.phase);
    state.phase = "Play";
    room.patch();
    seat.name = "Ada";
    const names = observe(() => manager.me()?.name);
    room.patch();
    flushSync();
    expect(phases.values.at(-1)).toBe("Play");
    expect(names.values.at(-1)).toBe("Ada");
    seat.name = "Bo";
    room.patch();
    flushSync();
    expect(names.values.at(-1)).toBe("Bo");
    phases.stop();
    names.stop();
  });

  it("stops listening when the last reader goes away", () => {
    const manager = newManager();
    const { state, room } = seated(manager);
    manager.attach(room);
    const seen = observe(() => manager.state?.phase);
    seen.stop();
    state.phase = "Later";
    room.patch();
    expect(seen.values).toEqual(["Lobby"]);
  });

  it("follows the manager from one room to the next", () => {
    const manager = newManager();
    const first = seated(manager);
    manager.attach(first.room);
    const codes = observe(() => manager.roomCode);
    const second = seated(manager);
    second.state.roomCode = "WXYZ";
    manager.attach(second.room);
    second.state.phase = "Elsewhere";
    second.room.patch();
    first.room.patch();
    flushSync();
    expect(codes.values).toEqual(["ABCD", "WXYZ"]);
    codes.stop();
  });

  it("reflects status changes", () => {
    const manager = newManager();
    const statuses = observe(() => manager.status);
    manager.attach(seated(manager).room);
    flushSync();
    expect(statuses.values).toEqual(["idle", "connected"]);
    statuses.stop();
  });
});

describe("sendAction", () => {
  it("sends the payload with the action type last and resolves ok", async () => {
    const manager = newManager();
    const { room } = seated(manager);
    manager.attach(room);
    expect(await manager.sendAction("PRESS", { power: 3 })).toEqual({ ok: true });
    expect(await manager.sendAction("PASS")).toEqual({ ok: true });
    expect(room.requests).toEqual([
      { type: "ACTION", payload: { power: 3, type: "PRESS" } },
      { type: "ACTION", payload: { type: "PASS" } },
    ]);
    expect(manager.lastServerError).toBeUndefined();
  });

  it("needs no new API for a spectator: an attached seatless room can send actions", async () => {
    const manager = newManager();
    manager.attach(new StubRoom(new BaseGameState()));
    expect(manager.isSpectator).toBe(true);
    expect(await manager.sendAction("PRESS")).toEqual({ ok: true });
  });

  it("refuses a payload that names the reserved type field without sending", async () => {
    const manager = newManager();
    const { room } = seated(manager);
    manager.attach(room);
    expect(await manager.sendAction("PRESS", { power: 3, type: "SPOOF" })).toEqual({
      ok: false,
      error: { code: ErrorCode.INVALID_ACTION, message: CLIENT_MESSAGES.INVALID_ACTION },
    });
    expect(manager.lastServerError?.code).toBe(ErrorCode.INVALID_ACTION);
    expect(room.requests).toEqual([]);
  });

  it("returns and records a rejection", async () => {
    const manager = newManager();
    const { room } = seated(manager);
    manager.attach(room);
    const error = { code: ErrorCode.WRONG_PHASE, message: "Not now", action: "PRESS" };
    room.reply = { ok: false, error };
    expect(await manager.sendAction("PRESS")).toEqual({ ok: false, error });
    expect(manager.lastServerError).toEqual(error);
    manager.dismissError();
    expect(manager.lastServerError).toBeUndefined();
  });

  it("turns a request rejection into a fixed CONNECTION_LOST result and hands the exception to the logger only", async () => {
    const logger = vi.fn();
    const manager = new GameConnectionManager({
      endpoint: "ws://localhost:2567",
      roomName: "stub",
      storagePrefix: `unit${++counter}`,
      logger,
    });
    const { room } = seated(manager);
    const cause = new Error('Zod: buzzMs must be "fast"');
    room.request = () => Promise.reject(cause);
    manager.attach(room);
    const result = await manager.sendAction("PRESS");
    expect(result).toEqual({
      ok: false,
      error: { code: ErrorCode.CONNECTION_LOST, message: CLIENT_MESSAGES.CONNECTION_LOST },
    });
    expect(JSON.stringify(manager.lastServerError)).not.toContain("Zod");
    expect(logger).toHaveBeenCalledWith(expect.any(String), cause);
    room.request = () => Promise.reject("odd");
    expect((await manager.sendAction("PRESS")).ok).toBe(false);
    expect(manager.lastServerError).toEqual({
      code: ErrorCode.CONNECTION_LOST,
      message: CLIENT_MESSAGES.CONNECTION_LOST,
    });
  });

  it("logs a request rejection with console.warn by default", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const manager = newManager();
    const { room } = seated(manager);
    room.request = () => Promise.reject(new Error("down"));
    manager.attach(room);
    await manager.sendAction("PRESS");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("does not trust a malformed reply", async () => {
    const manager = newManager();
    const { room } = seated(manager);
    room.reply = "yes";
    manager.attach(room);
    const result = await manager.sendAction("PRESS");
    expect(result).toEqual({
      ok: false,
      error: { code: ErrorCode.BAD_REPLY, message: CLIENT_MESSAGES.BAD_REPLY },
    });
  });

  it("gives the three local failures three distinct messages", () => {
    const messages = [
      CLIENT_MESSAGES.NOT_CONNECTED,
      CLIENT_MESSAGES.CONNECTION_LOST,
      CLIENT_MESSAGES.BAD_REPLY,
      CLIENT_MESSAGES.INTERNAL,
    ];
    expect(new Set(messages).size).toBe(4);
  });
});

describe("exportReplay", () => {
  it("resolves with the bundle and records the host-only request", async () => {
    const manager = newManager();
    const { room } = seated(manager, "host");
    const bundle = { bundleVersion: 1, name: "stub-game", snapshots: [] };
    room.reply = bundle;
    manager.attach(room);
    await expect(manager.exportReplay()).resolves.toEqual(bundle);
    expect(room.requests).toEqual([{ type: ClientMessage.EXPORT_REPLAY, payload: undefined }]);
  });

  it("hands a server refusal through and remembers it", async () => {
    const manager = newManager();
    const { room } = seated(manager);
    room.reply = {
      ok: false,
      error: { code: ErrorCode.UNAUTHORIZED, message: "only the host can export" },
    };
    manager.attach(room);
    await expect(manager.exportReplay()).resolves.toEqual({
      ok: false,
      error: { code: ErrorCode.UNAUTHORIZED, message: "only the host can export" },
    });
    expect(manager.lastServerError).toEqual({
      code: ErrorCode.UNAUTHORIZED,
      message: "only the host can export",
    });
  });

  it("refuses with NOT_CONNECTED when not in a room", async () => {
    const manager = newManager();
    await expect(manager.exportReplay()).resolves.toEqual({
      ok: false,
      error: { code: ErrorCode.NOT_CONNECTED, message: CLIENT_MESSAGES.NOT_CONNECTED },
    });
  });

  it("does not trust a malformed refusal", async () => {
    const manager = newManager();
    const { room } = seated(manager, "host");
    room.reply = { ok: false, error: "garbage" };
    manager.attach(room);
    await expect(manager.exportReplay()).resolves.toEqual({
      ok: false,
      error: { code: ErrorCode.BAD_REPLY, message: CLIENT_MESSAGES.BAD_REPLY },
    });
  });

  it("does not trust a non-object reply", async () => {
    const manager = newManager();
    const { room } = seated(manager, "host");
    room.reply = "yes";
    manager.attach(room);
    await expect(manager.exportReplay()).resolves.toEqual({
      ok: false,
      error: { code: ErrorCode.BAD_REPLY, message: CLIENT_MESSAGES.BAD_REPLY },
    });
  });

  it("does not trust a null or an array reply", async () => {
    const manager = newManager();
    const { room } = seated(manager, "host");
    manager.attach(room);
    room.reply = null;
    await expect(manager.exportReplay()).resolves.toEqual({
      ok: false,
      error: { code: ErrorCode.BAD_REPLY, message: CLIENT_MESSAGES.BAD_REPLY },
    });
    room.reply = [];
    await expect(manager.exportReplay()).resolves.toEqual({
      ok: false,
      error: { code: ErrorCode.BAD_REPLY, message: CLIENT_MESSAGES.BAD_REPLY },
    });
  });

  it("turns a request rejection into CONNECTION_LOST and hands the exception to the logger only", async () => {
    const logger = vi.fn();
    const manager = new GameConnectionManager({
      endpoint: "ws://localhost:2567",
      roomName: "stub",
      storagePrefix: `unit${++counter}`,
      logger,
    });
    const { room } = seated(manager, "host");
    const cause = new Error("socket gone");
    room.request = () => Promise.reject(cause);
    manager.attach(room);
    await expect(manager.exportReplay()).resolves.toEqual({
      ok: false,
      error: { code: ErrorCode.CONNECTION_LOST, message: CLIENT_MESSAGES.CONNECTION_LOST },
    });
    expect(logger).toHaveBeenCalledWith(expect.any(String), cause);
  });

  it("logs a request rejection with console.warn by default", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const manager = newManager();
    const { room } = seated(manager, "host");
    room.request = () => Promise.reject(new Error("down"));
    manager.attach(room);
    await manager.exportReplay();
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("refused joins", () => {
  it("records a refused join as the fixed close-code error and keeps rejecting", async () => {
    const manager = newManager();
    vi.stubGlobal("fetch", fakeFetch({ roomId: "room-1" }).fetch);
    vi.spyOn(Client.prototype, "joinById").mockRejectedValue(
      Object.assign(new Error("Room is full"), { code: CLOSE_CODES.ROOM_FULL.code }),
    );
    await expect(manager.join("ABCD")).rejects.toThrow();
    expect(manager.lastServerError).toEqual({
      code: CLOSE_CODES.ROOM_FULL.errorCode,
      message: CLOSE_CODES.ROOM_FULL.message,
    });
    expect(manager.status).toBe("disconnected");
  });

  it("records a refused token reconnect the same way and reports false", async () => {
    const manager = newManager();
    sessionStorage.setItem(`unit${counter}.reconnectionToken`, "stale");
    vi.spyOn(Client.prototype, "reconnect").mockRejectedValue(
      Object.assign(new Error("Your seat was removed"), { code: CLOSE_CODES.SEAT_REMOVED.code }),
    );
    expect(await manager.resume()).toBe(false);
    expect(manager.lastServerError).toEqual({
      code: CLOSE_CODES.SEAT_REMOVED.errorCode,
      message: CLOSE_CODES.SEAT_REMOVED.message,
    });
  });

  it.each([CLOSE_CODES.KICKED_REJOIN, CLOSE_CODES.WATCH_ONLY])(
    "records a refused join closed with $code as its own fixed message",
    async (entry) => {
      const manager = newManager();
      vi.stubGlobal("fetch", fakeFetch({ roomId: "room-1" }).fetch);
      vi.spyOn(Client.prototype, "joinById").mockRejectedValue(
        Object.assign(new Error("internal detail"), { code: entry.code }),
      );
      await expect(manager.join("ABCD")).rejects.toThrow();
      expect(manager.lastServerError).toEqual({ code: entry.errorCode, message: entry.message });
    },
  );

  it("records a rejection without a close code as CONNECTION_LOST, logs it and rethrows it", async () => {
    const logger = vi.fn();
    const manager = new GameConnectionManager({
      endpoint: "ws://localhost:2567",
      roomName: "stub",
      storagePrefix: `unit${++counter}`,
      logger,
    });
    const cause = new Error('Zod: buzzMs must be "fast"');
    vi.spyOn(Client.prototype, "create").mockRejectedValue(cause);
    await expect(manager.create()).rejects.toBe(cause);
    expect(manager.lastServerError).toEqual({
      code: ErrorCode.CONNECTION_LOST,
      message: CLIENT_MESSAGES.CONNECTION_LOST,
    });
    expect(logger).toHaveBeenCalledWith(expect.any(String), cause);
  });

  it("records an unknown room code as ROOM_NOT_FOUND", async () => {
    const manager = newManager();
    const network = stubFetchReply({ error: "Game code not found" });
    await expect(manager.join("WXYZ")).rejects.toBeInstanceOf(RoomCodeError);
    expect(network.urls).toHaveLength(1);
    expect(manager.lastServerError).toEqual({
      code: ErrorCode.ROOM_NOT_FOUND,
      message: CLIENT_MESSAGES.ROOM_NOT_FOUND,
    });
  });

  it("records a malformed resolve-code reply as BAD_REPLY", async () => {
    const manager = newManager();
    stubFetchReply({ nope: true });
    await expect(manager.join("WXYZ")).rejects.toBeInstanceOf(RoomCodeError);
    expect(manager.lastServerError).toEqual({
      code: ErrorCode.BAD_REPLY,
      message: CLIENT_MESSAGES.BAD_REPLY,
    });
  });

  it("records an unreachable API as CONNECTION_LOST", async () => {
    const manager = newManager();
    stubFetchReply(new Error("fetch failed"));
    await expect(manager.join("WXYZ")).rejects.toThrow("Could not reach the game server");
    expect(manager.lastServerError?.code).toBe(ErrorCode.CONNECTION_LOST);
  });

  it("does not record a cancelled connect", async () => {
    const manager = newManager();
    stubFetchReply({ roomId: "room-1" });
    vi.spyOn(Client.prototype, "joinById").mockRejectedValue(new Error("late failure"));
    const stale = manager.join("WXYZ");
    await manager.leave();
    await expect(stale).rejects.toThrow();
    expect(manager.lastServerError).toBeUndefined();
  });
});

describe("messages", () => {
  it("delivers to listeners registered before and after the room, and survives a room change", () => {
    const manager = newManager();
    const early: unknown[] = [];
    manager.onMessage("TICK", (payload) => early.push(payload));
    const first = seated(manager);
    manager.attach(first.room);
    const late: unknown[] = [];
    manager.onMessage("TICK", (payload) => late.push(payload));
    first.room.push("TICK", 1);
    const second = seated(manager);
    manager.attach(second.room);
    second.room.push("TICK", 2);
    expect(early).toEqual([1, 2]);
    expect(late).toEqual([1, 2]);
    expect(first.room.messageListeners("TICK")).toBe(0);
  });

  it("stops delivering after unsubscribing", () => {
    const manager = newManager();
    const { room } = seated(manager);
    manager.attach(room);
    const seen: unknown[] = [];
    const off = manager.onMessage("TICK", (payload) => seen.push(payload));
    room.push("TICK", 1);
    off();
    room.push("TICK", 2);
    expect(seen).toEqual([1]);
    const before = newManager();
    before.onMessage("TICK", () => undefined)();
  });

  it("keeps a pushed ERROR for the UI and ignores junk", () => {
    const manager = newManager();
    const { room } = seated(manager);
    manager.attach(room);
    room.push("ERROR", "garbage");
    expect(manager.lastServerError).toBeUndefined();
    room.push("ERROR", { code: ErrorCode.KICKED, message: "Removed by the host" });
    expect(manager.lastServerError?.code).toBe(ErrorCode.KICKED);
  });
});

describe("connection lifecycle", () => {
  it("reconnecting while dropped, connected again afterwards", () => {
    const manager = newManager();
    const { room } = seated(manager);
    manager.attach(room);
    room.dropConnection();
    expect(manager.status).toBe("reconnecting");
    expect(manager.state).toBe(room.state);
    room.reconnectionToken = "fresh-token";
    room.reconnected();
    expect(manager.status).toBe("connected");
    expect(sessionStorage.getItem(`unit${counter}.reconnectionToken`)).toBe("fresh-token");
  });

  it("returns to disconnected without a state when the server ends the session", () => {
    const manager = newManager();
    const { room } = seated(manager);
    manager.attach(room);
    room.closed();
    expect(manager.status).toBe("disconnected");
    expect(manager.state).toBeUndefined();
    expect(sessionStorage.getItem(`unit${counter}.reconnectionToken`)).toBeNull();
    expect(localStorage.getItem(`unit${counter}.roomCode`)).toBeNull();
  });

  it("records a known close code on leave and ignores unknown ones", () => {
    const manager = newManager();
    const first = seated(manager);
    manager.attach(first.room);
    first.room.closed(CLOSE_CODES.SEAT_REMOVED.code, "internal detail");
    expect(manager.lastServerError).toEqual({
      code: CLOSE_CODES.SEAT_REMOVED.errorCode,
      message: CLOSE_CODES.SEAT_REMOVED.message,
    });
    const second = seated(manager);
    manager.attach(second.room);
    second.room.closed(1006, "internal detail");
    expect(manager.lastServerError).toEqual({
      code: CLOSE_CODES.SEAT_REMOVED.errorCode,
      message: CLOSE_CODES.SEAT_REMOVED.message,
    });
  });

  it("ignores events from a room it already left", () => {
    const manager = newManager();
    const first = seated(manager);
    manager.attach(first.room);
    const second = seated(manager);
    manager.attach(second.room);
    first.room.dropConnection();
    first.room.closed();
    expect(manager.status).toBe("connected");
    expect(manager.state).toBe(second.state);
  });

  it("remembers the token and the room code", () => {
    const manager = newManager();
    const { room } = seated(manager);
    manager.attach(room);
    expect(sessionStorage.getItem(`unit${counter}.reconnectionToken`)).toBe("stub-token");
    expect(localStorage.getItem(`unit${counter}.roomCode`)).toBe("ABCD");
  });

  it("does not remember an empty room code or token", () => {
    const manager = newManager();
    const { state, room } = seated(manager);
    state.roomCode = "";
    room.reconnectionToken = "";
    manager.attach(room);
    expect(localStorage.getItem(`unit${counter}.roomCode`)).toBeNull();
    expect(sessionStorage.getItem(`unit${counter}.reconnectionToken`)).toBeNull();
  });

  it("leave() forgets the session and closes the room", async () => {
    const manager = newManager();
    const { room } = seated(manager);
    manager.attach(room);
    await manager.leave();
    expect(manager.status).toBe("disconnected");
    expect(manager.state).toBeUndefined();
    expect(localStorage.getItem(`unit${counter}.roomCode`)).toBeNull();
    await manager.leave();
  });

  it("dispose() stops listening but keeps the session for a later resume", () => {
    const manager = newManager();
    const early: unknown[] = [];
    manager.onMessage("TICK", (payload) => early.push(payload));
    const { room } = seated(manager);
    manager.attach(room);
    manager.dispose();
    expect(manager.status).toBe("disconnected");
    room.push("TICK", 1);
    expect(early).toEqual([]);
    expect(manager.state).toBeUndefined();
    expect(localStorage.getItem(`unit${counter}.roomCode`)).toBe("ABCD");
    manager.dispose();
  });
});

describe("waiting for the first state", () => {
  it("stays connecting until the room code arrives", async () => {
    const manager = newManager();
    const { state, room } = seated(manager);
    state.roomCode = "";
    vi.spyOn(Client.prototype, "create").mockResolvedValue(room as never);
    const created = manager.create();
    await settle();
    expect(manager.status).toBe("connecting");
    room.patch();
    expect(manager.status).toBe("connecting");
    state.roomCode = "QRST";
    room.patch();
    await created;
    expect(manager.status).toBe("connected");
    expect(manager.roomCode).toBe("QRST");
    expect(localStorage.getItem(`unit${counter}.roomCode`)).toBe("QRST");
  });

  it("tolerates a room whose state is not decoded yet", async () => {
    const manager = newManager();
    const { state, room } = seated(manager);
    Reflect.set(room, "state", undefined);
    vi.spyOn(Client.prototype, "create").mockResolvedValue(room as never);
    const created = manager.create();
    await settle();
    expect(manager.status).toBe("connecting");
    Reflect.set(room, "state", state);
    room.patch();
    await created;
    expect(manager.status).toBe("connected");
  });

  it("fails when the room closes before the state arrives", async () => {
    const manager = newManager();
    const { state, room } = seated(manager);
    state.roomCode = "";
    vi.spyOn(Client.prototype, "create").mockResolvedValue(room as never);
    const created = manager.create();
    await settle();
    expect(manager.status).toBe("connecting");
    room.closed();
    await expect(created).rejects.toThrow("Disconnected before");
    expect(manager.status).toBe("disconnected");
  });
});

describe("countdown", () => {
  it("counts down to the phase end using the server clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const manager = newManager();
    const none = manager.countdown();
    expect(none.secondsLeft).toBe(0);
    none.destroy();
    const { state, room } = seated(manager);
    state.serverNow = 5_000_000;
    state.phaseEndsAt = 5_030_000;
    manager.attach(room);
    const countdown = manager.countdown();
    expect(countdown.secondsLeft).toBe(30);
    countdown.destroy();
    vi.useRealTimers();
  });
});

describe("racing connects", () => {
  const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  };

  it("the newest connect wins and the late room is left unattached", async () => {
    const manager = newManager();
    const first = seated(manager);
    const second = seated(manager);
    second.state.roomCode = "WXYZ";
    const slow = deferred<StubRoom<BaseGameState>>();
    vi.spyOn(Client.prototype, "create").mockReturnValue(slow.promise as never);
    vi.spyOn(Client.prototype, "reconnect").mockResolvedValue(second.room as never);
    const left = vi.spyOn(first.room, "leave");
    sessionStorage.setItem(`unit${counter}.reconnectionToken`, "t");
    const stale = manager.create();
    const winner = manager.resume();
    await settle();
    slow.resolve(first.room);
    await expect(stale).rejects.toThrow("cancelled");
    expect(left).toHaveBeenCalled();
    expect(manager.state).not.toBe(first.state);
    expect(manager.status).not.toBe("disconnected");
    await winner;
  });

  it("a stale failure does not mark the newer connect disconnected", async () => {
    const manager = newManager();
    const { room } = seated(manager);
    const slow = deferred<never>();
    vi.spyOn(Client.prototype, "create").mockReturnValue(slow.promise as never);
    vi.spyOn(Client.prototype, "reconnect").mockResolvedValue(room as never);
    sessionStorage.setItem(`unit${counter}.reconnectionToken`, "t");
    const stale = manager.create();
    const winner = manager.resume();
    await winner;
    slow.resolve(undefined as never);
    await expect(stale).rejects.toThrow();
    expect(manager.status).toBe("connected");
  });

  it("an older connect finishing does not clear the newer pending entry", async () => {
    const manager = newManager();
    const first = seated(manager);
    const second = seated(manager);
    const slowFirst = deferred<StubRoom<BaseGameState>>();
    const slowSecond = deferred<StubRoom<BaseGameState>>();
    const create = vi.spyOn(Client.prototype, "create");
    create.mockReturnValueOnce(slowFirst.promise as never);
    create.mockReturnValueOnce(slowSecond.promise as never);
    vi.spyOn(Client.prototype, "reconnect").mockReturnValue(slowSecond.promise as never);
    sessionStorage.setItem(`unit${counter}.reconnectionToken`, "t");
    const older = manager.create();
    const newer = manager.resume();
    slowFirst.resolve(first.room);
    await expect(older).rejects.toThrow("cancelled");
    const again = manager.resume();
    slowSecond.resolve(second.room);
    await Promise.all([newer, again]);
    expect(Client.prototype.reconnect).toHaveBeenCalledTimes(1);
    expect(manager.state).toBe(second.state);
  });

  it("leave() during a connect cancels it", async () => {
    const manager = newManager();
    const { room } = seated(manager);
    const slow = deferred<StubRoom<BaseGameState>>();
    vi.spyOn(Client.prototype, "create").mockReturnValue(slow.promise as never);
    const left = vi.spyOn(room, "leave");
    const created = manager.create();
    await manager.leave();
    slow.resolve(room);
    await expect(created).rejects.toThrow("cancelled");
    expect(left).toHaveBeenCalled();
    expect(manager.status).toBe("disconnected");
    expect(manager.state).toBeUndefined();
  });

  it("dispose() during a connect cancels it", async () => {
    const manager = newManager();
    const { room } = seated(manager);
    const slow = deferred<StubRoom<BaseGameState>>();
    vi.spyOn(Client.prototype, "create").mockReturnValue(slow.promise as never);
    const created = manager.create();
    manager.dispose();
    slow.resolve(room);
    await expect(created).rejects.toThrow("cancelled");
    expect(manager.state).toBeUndefined();
    expect(manager.status).toBe("disconnected");
  });

  it("leave() while closing the previous room cancels the connect before it starts", async () => {
    const manager = newManager();
    const old = seated(manager);
    manager.attach(old.room);
    const closing = deferred<number>();
    old.room.leave = () => closing.promise;
    const create = vi.spyOn(Client.prototype, "create");
    const created = manager.create();
    const left = manager.leave();
    closing.resolve(1000);
    await left;
    await expect(created).rejects.toThrow("cancelled");
    expect(create).not.toHaveBeenCalled();
    expect(manager.status).toBe("disconnected");
  });
});

describe("waiting for state, bounded", () => {
  const impatient = () =>
    new GameConnectionManager({
      endpoint: "ws://localhost:2567",
      roomName: "stub",
      storagePrefix: `unit${++counter}`,
      syncTimeoutMs: 20,
    });

  it("leaves the room and rejects when the state never arrives", async () => {
    const manager = impatient();
    const { state, room } = seated(manager);
    state.roomCode = "";
    vi.spyOn(Client.prototype, "create").mockResolvedValue(room as never);
    const left = vi.spyOn(room, "leave");
    await expect(manager.create()).rejects.toThrow("Timed out");
    expect(left).toHaveBeenCalled();
    expect(manager.status).toBe("disconnected");
    expect(manager.state).toBeUndefined();
  });

  it("ignores a late state change or leave once settled", async () => {
    const manager = impatient();
    const { state, room } = seated(manager);
    vi.spyOn(Client.prototype, "create").mockResolvedValue(room as never);
    await manager.create();
    state.roomCode = "NEWC";
    room.patch();
    expect(manager.roomCode).toBe("NEWC");
    room.closed();
    expect(manager.status).toBe("disconnected");
  });

  it("does not time out after a synced connect", async () => {
    vi.useFakeTimers();
    const manager = impatient();
    const { room } = seated(manager);
    vi.spyOn(Client.prototype, "create").mockResolvedValue(room as never);
    const left = vi.spyOn(room, "leave");
    await manager.create();
    await vi.advanceTimersByTimeAsync(1000);
    expect(left).not.toHaveBeenCalled();
    expect(manager.status).toBe("connected");
    vi.useRealTimers();
  });

  it("removes its temporary leave listener once synced", async () => {
    const manager = impatient();
    const { room } = seated(manager);
    vi.spyOn(Client.prototype, "create").mockResolvedValue(room as never);
    await manager.create();
    expect(room.leaveListenerCount()).toBe(1);
  });

  it("swallows a rejecting leave on the timeout", async () => {
    const manager = impatient();
    const { state, room } = seated(manager);
    state.roomCode = "";
    vi.spyOn(Client.prototype, "create").mockResolvedValue(room as never);
    room.leave = () => Promise.reject(new Error("boom"));
    const unhandled = watchUnhandled();
    await expect(manager.create()).rejects.toThrow("Timed out");
    await settle();
    unhandled.stop();
    expect(unhandled.seen).toEqual([]);
  });

  it("a settled wait ignores a later leave from the same room", async () => {
    const manager = impatient();
    const { state, room } = seated(manager);
    state.roomCode = "";
    vi.spyOn(Client.prototype, "create").mockResolvedValue(room as never);
    const created = manager.create();
    await settle();
    state.roomCode = "OKAY";
    room.patch();
    await created;
    room.patch();
    room.closed();
    expect(manager.status).toBe("disconnected");
  });
});

describe("a rejecting room.leave()", () => {
  it("dispose() swallows the rejection", async () => {
    const manager = newManager();
    const { room } = seated(manager);
    room.leave = () => Promise.reject(new Error("boom"));
    manager.attach(room);
    const unhandled = watchUnhandled();
    manager.dispose();
    await settle();
    unhandled.stop();
    expect(unhandled.seen).toEqual([]);
  });

  it("a cancelled join swallows the rejection", async () => {
    const manager = newManager();
    const state = new BaseGameState();
    state.roomCode = "";
    const room = new StubRoom(state);
    room.leave = () => Promise.reject(new Error("boom"));
    vi.stubGlobal("fetch", fakeFetch({ roomId: room.roomId }).fetch);
    vi.spyOn(Client.prototype, "joinById").mockResolvedValue(room as never);
    const unhandled = watchUnhandled();
    const joining = manager.join("ABCD");
    await settle();
    await manager.leave();
    state.roomCode = "ABCD";
    room.patch();
    await expect(joining).rejects.toThrow("Connection cancelled");
    await settle();
    unhandled.stop();
    expect(unhandled.seen).toEqual([]);
  });
});

describe("resume", () => {
  it("clears the session and reports false when the token is rejected and no code is stored", async () => {
    const manager = newManager();
    sessionStorage.setItem(`unit${counter}.reconnectionToken`, "stale");
    vi.spyOn(Client.prototype, "reconnect").mockRejectedValue(new Error("expired"));
    expect(await manager.resume()).toBe(false);
    expect(sessionStorage.getItem(`unit${counter}.reconnectionToken`)).toBeNull();
    expect(manager.status).toBe("disconnected");
  });
});

describe("protocol versioning", () => {
  it("sends the current protocol version when creating and joining", async () => {
    const manager = newManager();
    const { room } = seated(manager);
    stubFetchReply({ roomId: "room-1" });
    const created = vi.spyOn(Client.prototype, "create").mockResolvedValue(room as never);
    await manager.create();
    expect(created).toHaveBeenCalledWith(
      "stub",
      expect.objectContaining({ protocolVersion: PROTOCOL_VERSION }),
      undefined,
    );
    const joined = vi.spyOn(Client.prototype, "joinById").mockResolvedValue(room as never);
    await manager.join("WXYZ");
    expect(joined).toHaveBeenCalledWith(
      "room-1",
      expect.objectContaining({ protocolVersion: PROTOCOL_VERSION }),
      undefined,
    );
  });

  it("sends the persisted seat secret when creating and joining", async () => {
    const manager = newManager();
    const { room } = seated(manager);
    stubFetchReply({ roomId: "room-1" });
    const created = vi.spyOn(Client.prototype, "create").mockResolvedValue(room as never);
    await manager.create();
    expect(created).toHaveBeenCalledWith(
      "stub",
      expect.objectContaining({ seatSecret: expect.stringMatching(/^[0-9a-f-]{72}$/) }),
      undefined,
    );
    const joined = vi.spyOn(Client.prototype, "joinById").mockResolvedValue(room as never);
    await manager.join("WXYZ");
    expect(joined).toHaveBeenCalledWith(
      "room-1",
      expect.objectContaining({ seatSecret: expect.stringMatching(/^[0-9a-f-]{72}$/) }),
      undefined,
    );
    expect(localStorage.getItem(`unit${counter}.seatSecret`)).toMatch(/^[0-9a-f-]{72}$/);
  });

  it("shows both versions when a join is refused for a protocol mismatch", async () => {
    const manager = newManager();
    stubFetchReply({ roomId: "room-1" });
    vi.spyOn(Client.prototype, "joinById").mockRejectedValue(
      Object.assign(new Error("Protocol version mismatch: client 9, server 1"), {
        code: CLOSE_CODES.VERSION_MISMATCH.code,
      }),
    );
    await expect(manager.join("WXYZ")).rejects.toThrow();
    expect(manager.lastServerError).toEqual({
      code: ErrorCode.NOT_ALLOWED,
      message: "Protocol version mismatch: client 9, server 1",
    });
  });

  it.each([
    { code: CLOSE_CODES.VERSION_MISMATCH.code },
    { code: CLOSE_CODES.VERSION_MISMATCH.code, message: 123 },
  ])(
    "falls back to the fixed template when the mismatch text is not a string (%i)",
    async (error) => {
      const manager = newManager();
      stubFetchReply({ roomId: "room-1" });
      vi.spyOn(Client.prototype, "joinById").mockRejectedValue(error);
      await expect(manager.join("WXYZ")).rejects.toThrow();
      expect(manager.lastServerError).toEqual({
        code: ErrorCode.NOT_ALLOWED,
        message: CLOSE_CODES.VERSION_MISMATCH.message,
      });
    },
  );
});
