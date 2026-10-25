import { ErrorCode } from "./protocol.js";

/**
 * A framework-internal error carrying an {@link ErrorCode}. Its `message` is for server logs and
 * the action log; clients only ever see {@link CLIENT_MESSAGES} for its code.
 */
export class FrameworkError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "FrameworkError";
    this.code = code;
  }
}

/** One join/create close code and what it means to a client. */
export interface CloseCode {
  /** The numeric Colyseus close code sent to the client. */
  code: number;
  /** The {@link ErrorCode} the client sees for this close. */
  errorCode: ErrorCode;
  /** The fixed, client-safe message. */
  message: string;
}

/**
 * Join/create close codes (4400-4406, 4409, 4426, 4429, 4500), each mapped to an {@link ErrorCode} and a
 * fixed message. `VERSION_MISMATCH`'s message is a template the server fills with both versions
 * (numbers only; a missing client version renders as `unknown`) before closing.
 */
export const CLOSE_CODES = {
  INVALID_OPTIONS: {
    code: 4400,
    errorCode: ErrorCode.INVALID_ACTION,
    message: "Invalid room options",
  },
  ROOM_FULL: { code: 4401, errorCode: ErrorCode.NOT_ALLOWED, message: "Room is full" },
  SEAT_REMOVED: { code: 4402, errorCode: ErrorCode.KICKED, message: "Your seat was removed" },
  KICKED_REJOIN: { code: 4403, errorCode: ErrorCode.KICKED, message: "Removed by the host" },
  WATCH_ONLY: {
    code: 4404,
    errorCode: ErrorCode.NOT_ALLOWED,
    message: "This room is watch-only",
  },
  CONTENT_REJECTED: {
    code: 4405,
    errorCode: ErrorCode.CONTENT_REJECTED,
    message: "That text was not allowed",
  },
  /** A join naming a seated `playerId` without that seat's matching secret. */
  SEAT_TAKEN: { code: 4406, errorCode: ErrorCode.UNAUTHORIZED, message: "Seat is taken" },
  /** The old session of a seat taken over by another connection presenting the same secret. */
  SEAT_TAKEN_OVER: {
    code: 4409,
    errorCode: ErrorCode.KICKED,
    message: "Your seat was opened on another device",
  },
  VERSION_MISMATCH: {
    code: 4426,
    errorCode: ErrorCode.NOT_ALLOWED,
    message: "Protocol version mismatch: client {client}, server {server}",
  },
  /** A create refused because the server already hosts `maxRooms` rooms. */
  SERVER_FULL: { code: 4429, errorCode: ErrorCode.NOT_ALLOWED, message: "Server is full" },
  INTERNAL: {
    code: 4500,
    errorCode: ErrorCode.INTERNAL,
    message: "The server could not handle the request",
  },
} satisfies Record<string, CloseCode>;

/** The close-code entry for a numeric close code, or `undefined` for unknown numbers. */
export function closeCodeEntry(code: number): CloseCode | undefined {
  return Object.values(CLOSE_CODES).find((entry) => entry.code === code);
}

/** One fixed, client-safe message per {@link ErrorCode}; clients never see any other text. */
export const CLIENT_MESSAGES: Record<ErrorCode, string> = {
  INVALID_ACTION: "The action was invalid",
  UNKNOWN_ACTION: "Unknown action",
  WRONG_PHASE: "The action is not allowed in this phase",
  UNAUTHORIZED: "You are not allowed to do that",
  NOT_ENOUGH_PLAYERS: "Not enough players to start",
  NOT_ALLOWED: "This action is not allowed",
  NOT_ACTIVE: "You are waiting to be let in",
  CONTENT_REJECTED: "That text was not allowed",
  NAME_TAKEN: "That name is already taken",
  KICKED: "Removed by the host",
  INTERNAL: "The action failed on the server",
  RATE_LIMITED: "You are sending actions too quickly",
  NOT_CONNECTED: "You are not connected to a room",
  CONNECTION_LOST: "The connection to the server was lost",
  BAD_REPLY: "The server sent an unexpected reply",
  ROOM_NOT_FOUND: "Game code not found",
};
