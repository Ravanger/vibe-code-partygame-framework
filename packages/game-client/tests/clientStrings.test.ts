import { Client } from "@colyseus/sdk";
import { CLIENT_MESSAGES, ErrorCode, ROOM_CODE_LENGTH } from "@partygame/shared";
import { BaseGameState } from "@partygame/shared/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameConnectionManager } from "../src/GameConnectionManager.svelte.js";
import { defaultClientStrings } from "../src/strings.js";
import { StubRoom } from "../src/testing.js";

interface Strings {
  notConnected?: string;
  invalidRoomCode?: string;
  syncDisconnected?: string;
  syncTimedOut?: string;
  errors?: Partial<Record<ErrorCode, string>>;
}

let counter = 0;
const newManager = (strings?: Strings) =>
  new GameConnectionManager({
    endpoint: "ws://localhost:2567",
    roomName: "stub",
    storagePrefix: `strings${++counter}`,
    ...(strings === undefined ? {} : { strings }),
  });

/** A room whose state has not synced yet (no roomCode), standing in for the SDK's create. */
const unsyncedRoom = (): StubRoom<BaseGameState> => {
  const room = new StubRoom(new BaseGameState());
  vi.spyOn(Client.prototype, "create").mockResolvedValue(room as never);
  return room;
};

const settle = () => new Promise((resolve) => setTimeout(resolve));

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("client strings", () => {
  it("reports the table's text for a matching failure", async () => {
    const manager = newManager({ notConnected: "Nicht verbunden" });
    const result = await manager.sendAction("PRESS");
    expect(result).toEqual({
      ok: false,
      error: { code: ErrorCode.NOT_CONNECTED, message: "Nicht verbunden" },
    });
    expect(manager.lastServerError?.message).toBe("Nicht verbunden");
  });

  it("falls back to the English default for an unspecified key", async () => {
    const manager = newManager({ notConnected: "Nicht verbunden" });
    await expect(manager.join("no1")).rejects.toThrow(
      `Game code must be ${ROOM_CODE_LENGTH} letters (A-Z)`,
    );
  });

  it("derives the default room-code message from ROOM_CODE_LENGTH", () => {
    expect(defaultClientStrings.invalidRoomCode).toBe(
      `Game code must be ${ROOM_CODE_LENGTH} letters (A-Z)`,
    );
  });

  it("replaces the room-code message when the table has it", async () => {
    const manager = newManager({ invalidRoomCode: "Bitte genau 4 Buchstaben" });
    await expect(manager.join("no1")).rejects.toThrow("Bitte genau 4 Buchstaben");
  });

  it("replaces lastServerError.message with strings.errors[code] when the table has the code", async () => {
    const manager = newManager({ errors: { [ErrorCode.NOT_CONNECTED]: "Kein Raum" } });
    await manager.sendAction("PRESS");
    expect(manager.lastServerError).toEqual({
      code: ErrorCode.NOT_CONNECTED,
      message: "Kein Raum",
    });
  });

  it("keeps the message when the table has no entry for the code", async () => {
    const manager = newManager({ errors: { [ErrorCode.KICKED]: "Entfernt" } });
    await manager.sendAction("PRESS");
    expect(manager.lastServerError?.message).toBe(CLIENT_MESSAGES.NOT_CONNECTED);
  });

  it("keeps the untilSynced rejection defaults in the table", () => {
    expect(defaultClientStrings.syncDisconnected).toBe(
      "Disconnected before the game state arrived",
    );
    expect(defaultClientStrings.syncTimedOut).toBe("Timed out waiting for the game state");
  });

  it("replaces the disconnect-before-sync rejection when the table has it", async () => {
    const manager = newManager({ syncDisconnected: "Verbindung abgebrochen" });
    const room = unsyncedRoom();
    const created = manager.create();
    await settle();
    room.closed();
    await expect(created).rejects.toThrow("Verbindung abgebrochen");
  });

  it("replaces the sync-timeout rejection when the table has it", async () => {
    const manager = new GameConnectionManager({
      endpoint: "ws://localhost:2567",
      roomName: "stub",
      storagePrefix: `strings${++counter}`,
      syncTimeoutMs: 20,
      strings: { syncTimedOut: "Zeitüberschreitung" },
    });
    unsyncedRoom();
    await expect(manager.create()).rejects.toThrow("Zeitüberschreitung");
  });
});
