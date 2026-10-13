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
  it("maps the four join/create close codes to error codes and fixed messages", () => {
    expect(Object.keys(CLOSE_CODES).sort()).toEqual([
      "INVALID_OPTIONS",
      "JOIN_REFUSED",
      "ROOM_FULL",
      "SEAT_REMOVED",
    ]);
    expect(CLOSE_CODES.INVALID_OPTIONS.code).toBe(4400);
    expect(CLOSE_CODES.ROOM_FULL.code).toBe(4401);
    expect(CLOSE_CODES.SEAT_REMOVED.code).toBe(4402);
    expect(CLOSE_CODES.JOIN_REFUSED.code).toBe(4403);
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
    expect(CLOSE_CODES.JOIN_REFUSED.message).toBe("You cannot join this room");
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
    expect(closeCodeEntry(4404)).toBeUndefined();
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

  it("keeps the INTERNAL text clients see today", () => {
    expect(CLIENT_MESSAGES.INTERNAL).toBe("The action failed on the server");
  });
});
