import { CLIENT_MESSAGES, ErrorCode, ROOM_CODE_LENGTH } from "@partygame/shared";
import { afterEach, describe, expect, it } from "vitest";
import { GameConnectionManager } from "../src/GameConnectionManager.svelte.js";
import { defaultClientStrings } from "../src/strings.js";

interface Strings {
  notConnected?: string;
  invalidRoomCode?: string;
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

afterEach(() => {
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
});
