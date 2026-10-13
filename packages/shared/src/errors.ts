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

/** Join/create close codes (4400-4403), each mapped to an {@link ErrorCode} and a fixed message. */
export const CLOSE_CODES = {
  INVALID_OPTIONS: {
    code: 4400,
    errorCode: ErrorCode.INVALID_ACTION,
    message: "Invalid room options",
  },
  ROOM_FULL: { code: 4401, errorCode: ErrorCode.NOT_ALLOWED, message: "Room is full" },
  SEAT_REMOVED: { code: 4402, errorCode: ErrorCode.KICKED, message: "Your seat was removed" },
  JOIN_REFUSED: {
    code: 4403,
    errorCode: ErrorCode.NOT_ALLOWED,
    message: "You cannot join this room",
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
  NAME_TAKEN: "That name is already taken",
  KICKED: "Removed by the host",
  INTERNAL: "The action failed on the server",
};
