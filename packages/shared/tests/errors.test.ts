import { describe, expect, it } from "vitest";
import {
  CLIENT_MESSAGES,
  CLOSE_CODES,
  closeCodeEntry,
  ErrorCode,
  FrameworkError,
} from "../src/index.js";

describe("FrameworkError", () => {
  it("carries an ErrorCode and an internal message, and is an Error", () => {
    const error = new FrameworkError(ErrorCode.NOT_ALLOWED, "internal detail");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(FrameworkError);
    expect(error.code).toBe(ErrorCode.NOT_ALLOWED);
    expect(error.message).toBe("internal detail");
    expect(error.name).toBe("FrameworkError");
  });
});

describe("CLOSE_CODES", () => {
  it("maps the six join/create close codes to error codes and fixed messages", () => {
    expect(Object.keys(CLOSE_CODES).sort()).toEqual([
      "INTERNAL",
      "INVALID_OPTIONS",
      "KICKED_REJOIN",
      "ROOM_FULL",
      "SEAT_REMOVED",
      "WATCH_ONLY",
    ]);
    expect(CLOSE_CODES.INVALID_OPTIONS.code).toBe(4400);
    expect(CLOSE_CODES.ROOM_FULL.code).toBe(4401);
    expect(CLOSE_CODES.SEAT_REMOVED.code).toBe(4402);
    expect(CLOSE_CODES.KICKED_REJOIN.code).toBe(4403);
    expect(CLOSE_CODES.WATCH_ONLY.code).toBe(4404);
    expect(CLOSE_CODES.INTERNAL.code).toBe(4500);
    expect(CLOSE_CODES.INTERNAL.errorCode).toBe(ErrorCode.INTERNAL);
  });

  it("has a well-formed entry for every close code", () => {
    const known = new Set<string>(Object.values(ErrorCode));
    for (const [name, entry] of Object.entries(CLOSE_CODES)) {
      expect(Number.isInteger(entry.code), name).toBe(true);
      expect(known.has(entry.errorCode), name).toBe(true);
      expect(entry.message.length > 0, name).toBe(true);
    }
  });

  it("keeps the fixed message per close code", () => {
    expect(CLOSE_CODES.INVALID_OPTIONS.message).toBe("Invalid room options");
    expect(CLOSE_CODES.ROOM_FULL.message).toBe("Room is full");
    expect(CLOSE_CODES.SEAT_REMOVED.message).toBe("Your seat was removed");
    expect(CLOSE_CODES.KICKED_REJOIN.message).toBe(CLIENT_MESSAGES.KICKED);
    expect(CLOSE_CODES.WATCH_ONLY.message).toBe("This room is watch-only");
    expect(CLOSE_CODES.INTERNAL.message).toBe("The server could not handle the request");
    expect(CLOSE_CODES.KICKED_REJOIN.errorCode).toBe(ErrorCode.KICKED);
    expect(CLOSE_CODES.WATCH_ONLY.errorCode).toBe(ErrorCode.NOT_ALLOWED);
  });
});

describe("closeCodeEntry", () => {
  it("maps a numeric close code to its entry", () => {
    expect(closeCodeEntry(4401)).toBe(CLOSE_CODES.ROOM_FULL);
    for (const entry of Object.values(CLOSE_CODES)) {
      expect(closeCodeEntry(entry.code)).toEqual(entry);
    }
  });

  it("returns undefined for unknown numbers", () => {
    expect(closeCodeEntry(2000)).toBeUndefined();
    expect(closeCodeEntry(4405)).toBeUndefined();
    expect(closeCodeEntry(-1)).toBeUndefined();
  });
});

describe("CLIENT_MESSAGES", () => {
  it("has a non-empty fixed message for every ErrorCode", () => {
    for (const code of Object.values(ErrorCode)) {
      expect(typeof CLIENT_MESSAGES[code], code).toBe("string");
      expect(CLIENT_MESSAGES[code].length > 0, code).toBe(true);
    }
  });

  it("keeps the ROOM_NOT_FOUND text of the resolve-code API", () => {
    expect(CLIENT_MESSAGES.ROOM_NOT_FOUND).toBe("Game code not found");
  });

  it("keeps the INTERNAL text clients see today", () => {
    expect(CLIENT_MESSAGES.INTERNAL).toBe("The action failed on the server");
  });

  it("has a fixed message for CONTENT_REJECTED", () => {
    expect(CLIENT_MESSAGES.CONTENT_REJECTED).toBe("That text was not allowed");
  });
});
