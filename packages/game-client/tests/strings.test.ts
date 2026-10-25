import { Client } from "@colyseus/sdk";
import { CLIENT_MESSAGES, CLOSE_CODES, ErrorCode } from "@partygame/shared";
import { BaseGameState, PlayerSchema } from "@partygame/shared/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameConnectionManager } from "../src/GameConnectionManager.svelte.js";
import { defaultClientStrings as exportedDefault } from "../src/index.js";
import { type ClientStrings, defaultClientStrings } from "../src/strings.js";
import { fakeFetch, StubRoom } from "../src/testing.js";

let counter = 0;
const newManager = (options: Record<string, unknown> = {}) =>
  new GameConnectionManager({
    endpoint: "ws://localhost:2567",
    roomName: "stub",
    storagePrefix: `strings${++counter}`,
    ...options,
  });

function seated(manager: GameConnectionManager) {
  const state = new BaseGameState();
  state.roomCode = "ABCD";
  const seat = new PlayerSchema();
  seat.id = manager.playerId;
  state.players.set(manager.playerId, seat);
  return { state, room: new StubRoom(state) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("defaultClientStrings", () => {
  it("holds the English text for every client-owned string and is exported from the index", () => {
    expect(exportedDefault).toBe(defaultClientStrings);
    expect(defaultClientStrings.errors).toEqual(CLIENT_MESSAGES);
    expect(defaultClientStrings.invalidRoomCode).toMatch(/Game code must be 4 letters \(A-Z\)/);
    expect(defaultClientStrings.disconnectedBeforeState).toBe(
      "Disconnected before the game state arrived",
    );
    expect(defaultClientStrings.syncTimeout).toBe("Timed out waiting for the game state");
  });

  it("is used when no strings option is given", async () => {
    const manager = newManager();
    const result = await manager.sendAction("PRESS");
    expect(result).toEqual({
      ok: false,
      error: { code: ErrorCode.NOT_CONNECTED, message: CLIENT_MESSAGES.NOT_CONNECTED },
    });
  });
});

describe("strings option", () => {
  it("replaces the client-owned failure text for a listed code and falls back otherwise", async () => {
    const manager = newManager({ strings: { errors: { NOT_CONNECTED: "Nicht verbunden" } } });
    const result = await manager.sendAction("PRESS");
    expect(result).toEqual({
      ok: false,
      error: { code: ErrorCode.NOT_CONNECTED, message: "Nicht verbunden" },
    });
    expect(manager.lastServerError?.message).toBe("Nicht verbunden");
    const { room } = seated(manager);
    manager.attach(room);
    room.reply = "yes";
    expect(await manager.sendAction("PRESS")).toEqual({
      ok: false,
      error: { code: ErrorCode.BAD_REPLY, message: CLIENT_MESSAGES.BAD_REPLY },
    });
  });

  it("replaces a pushed ERROR only when the table names its code, and keeps the server text otherwise", () => {
    const manager = newManager({ strings: { errors: { KICKED: "Entfernt vom Host" } } });
    const { room } = seated(manager);
    manager.attach(room);
    room.push("ERROR", { code: ErrorCode.KICKED, message: "Removed by the host" });
    expect(manager.lastServerError).toEqual({
      code: ErrorCode.KICKED,
      message: "Entfernt vom Host",
    });
    room.push("ERROR", { code: ErrorCode.WRONG_PHASE, message: "Not now", action: "PRESS" });
    expect(manager.lastServerError).toEqual({
      code: ErrorCode.WRONG_PHASE,
      message: "Not now",
      action: "PRESS",
    });
  });

  it("replaces a close-code error only when the table names its code, else keeps the fixed message", async () => {
    const manager = newManager({ strings: { errors: { NOT_ALLOWED: "Nicht erlaubt" } } });
    vi.stubGlobal("fetch", fakeFetch({ roomId: "room-1" }).fetch);
    vi.spyOn(Client.prototype, "joinById").mockRejectedValue(
      Object.assign(new Error("internal detail"), { code: CLOSE_CODES.ROOM_FULL.code }),
    );
    await expect(manager.join("ABCD")).rejects.toThrow();
    expect(manager.lastServerError).toEqual({
      code: CLOSE_CODES.ROOM_FULL.errorCode,
      message: "Nicht erlaubt",
    });
    const plain = newManager();
    vi.spyOn(Client.prototype, "joinById").mockRejectedValue(
      Object.assign(new Error("internal detail"), { code: CLOSE_CODES.ROOM_FULL.code }),
    );
    await expect(plain.join("ABCD")).rejects.toThrow();
    expect(plain.lastServerError).toEqual({
      code: CLOSE_CODES.ROOM_FULL.errorCode,
      message: CLOSE_CODES.ROOM_FULL.message,
    });
  });

  it("throws the replaced text for a malformed join code", async () => {
    const manager = newManager({
      strings: { invalidRoomCode: "Der Code braucht vier Buchstaben" },
    });
    await expect(manager.join("no1")).rejects.toThrow("Der Code braucht vier Buchstaben");
  });

  it("uses the replaced text when the room closes before its first state", async () => {
    const manager = newManager({
      strings: { disconnectedBeforeState: "Getrennt, bevor der Spielstand ankam" },
    });
    const { state, room } = seated(manager);
    state.roomCode = "";
    vi.spyOn(Client.prototype, "create").mockResolvedValue(room as never);
    const created = manager.create();
    await settle();
    room.closed();
    await expect(created).rejects.toThrow("Getrennt, bevor der Spielstand ankam");
  });

  it("uses the replaced text when the first state times out", async () => {
    const manager = newManager({
      syncTimeoutMs: 20,
      strings: { syncTimeout: "Der Spielstand kam zu spät" },
    });
    const { state, room } = seated(manager);
    state.roomCode = "";
    vi.spyOn(Client.prototype, "create").mockResolvedValue(room as never);
    await expect(manager.create()).rejects.toThrow("Der Spielstand kam zu spät");
  });

  it("merges only the given keys over the defaults", async () => {
    const strings: Partial<ClientStrings> = { syncTimeout: "Später" };
    const manager = newManager({ strings });
    await expect(manager.join("no1")).rejects.toThrow(defaultClientStrings.invalidRoomCode);
  });
});
