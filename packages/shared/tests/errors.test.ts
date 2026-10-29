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
  it("maps the twelve join/create close codes to error codes and fixed messages", () => {
    expect(Object.keys(CLOSE_CODES).sort()).toEqual([
      "CONTENT_REJECTED",
      "INTERNAL",
      "INVALID_OPTIONS",
      "JOIN_REFUSED",
      "KICKED_REJOIN",
      "ROOM_FULL",
      "SEAT_REMOVED",
      "SEAT_TAKEN",
      "SEAT_TAKEN_OVER",
      "SERVER_FULL",
      "VERSION_MISMATCH",
      "WATCH_ONLY",
    ]);
    expect(CLOSE_CODES.INVALID_OPTIONS.code).toBe(4400);
    expect(CLOSE_CODES.ROOM_FULL.code).toBe(4401);
    expect(CLOSE_CODES.SEAT_REMOVED.code).toBe(4402);
    expect(CLOSE_CODES.KICKED_REJOIN.code).toBe(4403);
    expect(CLOSE_CODES.JOIN_REFUSED.code).toBe(4403);
    expect(CLOSE_CODES.JOIN_REFUSED.errorCode).toBe(ErrorCode.NOT_ALLOWED);
    expect(CLOSE_CODES.WATCH_ONLY.code).toBe(4404);
    expect(CLOSE_CODES.CONTENT_REJECTED.code).toBe(4405);
    expect(CLOSE_CODES.SEAT_TAKEN.code).toBe(4406);
    expect(CLOSE_CODES.SEAT_TAKEN.errorCode).toBe(ErrorCode.UNAUTHORIZED);
    expect(CLOSE_CODES.SEAT_TAKEN_OVER.code).toBe(4409);
    expect(CLOSE_CODES.SEAT_TAKEN_OVER.errorCode).toBe(ErrorCode.KICKED);
    expect(CLOSE_CODES.CONTENT_REJECTED.errorCode).toBe(ErrorCode.CONTENT_REJECTED);
    expect(CLOSE_CODES.SERVER_FULL.code).toBe(4429);
    expect(CLOSE_CODES.VERSION_MISMATCH.code).toBe(4426);
    expect(CLOSE_CODES.VERSION_MISMATCH.errorCode).toBe(ErrorCode.NOT_ALLOWED);
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
    expect(CLOSE_CODES.JOIN_REFUSED.message).toBe("You cannot join this room.");
    expect(CLOSE_CODES.WATCH_ONLY.message).toBe("This room is watch-only");
    expect(CLOSE_CODES.CONTENT_REJECTED.message).toBe(CLIENT_MESSAGES.CONTENT_REJECTED);
    expect(CLOSE_CODES.SEAT_TAKEN.message).toBe("Seat is taken");
    expect(CLOSE_CODES.SEAT_TAKEN_OVER.message).toBe("Your seat was opened on another device");
    expect(CLOSE_CODES.SERVER_FULL.message).toBe("Server is full");
    expect(CLOSE_CODES.VERSION_MISMATCH.message).toBe(
      "Protocol version mismatch: client {client}, server {server}",
    );
    expect(CLOSE_CODES.INTERNAL.message).toBe("The server could not handle the request");
    expect(CLOSE_CODES.KICKED_REJOIN.errorCode).toBe(ErrorCode.KICKED);
    expect(CLOSE_CODES.WATCH_ONLY.errorCode).toBe(ErrorCode.NOT_ALLOWED);
    expect(CLOSE_CODES.SERVER_FULL.errorCode).toBe(ErrorCode.NOT_ALLOWED);
  });
});

describe("closeCodeEntry", () => {
  it("maps a numeric close code to its first-registered entry", () => {
    expect(closeCodeEntry(4401)).toBe(CLOSE_CODES.ROOM_FULL);
    const firstByCode = new Map<number, (typeof CLOSE_CODES)[keyof typeof CLOSE_CODES]>();
    for (const entry of Object.values(CLOSE_CODES)) {
      firstByCode.set(entry.code, firstByCode.get(entry.code) ?? entry);
    }
    for (const entry of Object.values(CLOSE_CODES)) {
      expect(closeCodeEntry(entry.code)).toEqual(firstByCode.get(entry.code));
    }
    // 4403 is shared by KICKED_REJOIN and JOIN_REFUSED; the client keeps the kicked mapping.
    expect(closeCodeEntry(4403)).toBe(CLOSE_CODES.KICKED_REJOIN);
  });

  it("returns undefined for unknown numbers", () => {
    expect(closeCodeEntry(2000)).toBeUndefined();
    expect(closeCodeEntry(4407)).toBeUndefined();
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

  it("has a fixed message for RATE_LIMITED", () => {
    expect(CLIENT_MESSAGES.RATE_LIMITED).toBe("You are sending actions too quickly");
  });
});
