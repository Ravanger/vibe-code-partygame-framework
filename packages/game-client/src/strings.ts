import { CLIENT_MESSAGES, ErrorCode, ROOM_CODE_LENGTH } from "@partygame/shared";

/**
 * Every client-owned message the manager produces, in English. Pass a partial table to
 * `GameConnectionOptions.strings` to replace any of them; unspecified keys keep these defaults.
 */
export interface ClientStrings {
  /** Thrown by `join()` when the code is not 4 A-Z letters. */
  invalidRoomCode: string;
  /** An action was sent with no room joined (`NOT_CONNECTED`). */
  notConnected: string;
  /** The action payload carried the reserved `type` field (`INVALID_ACTION`). */
  invalidAction: string;
  /** The server's reply to a request was not an `ActionResult` (`BAD_REPLY`). */
  badReply: string;
  /** The connection failed or dropped in transit (`CONNECTION_LOST`). */
  connectionLost: string;
  /** The resolve-code API knows no room for the typed code (`ROOM_NOT_FOUND`). */
  roomNotFound: string;
  /** Per-code text applied to every error that lands in `lastServerError`, over any other source. */
  errors?: Partial<Record<ErrorCode, string>>;
}

/** The English defaults: every client-owned message the manager produces. */
export const defaultClientStrings: ClientStrings = {
  invalidRoomCode: `Game code must be ${ROOM_CODE_LENGTH} letters (A-Z)`,
  notConnected: CLIENT_MESSAGES[ErrorCode.NOT_CONNECTED],
  invalidAction: CLIENT_MESSAGES[ErrorCode.INVALID_ACTION],
  badReply: CLIENT_MESSAGES[ErrorCode.BAD_REPLY],
  connectionLost: CLIENT_MESSAGES[ErrorCode.CONNECTION_LOST],
  roomNotFound: CLIENT_MESSAGES[ErrorCode.ROOM_NOT_FOUND],
};

/** The client message for every error code: the table's named keys over `CLIENT_MESSAGES`. */
export function resolveClientMessages(strings: ClientStrings): Record<ErrorCode, string> {
  const messages: Record<ErrorCode, string> = { ...CLIENT_MESSAGES };
  messages[ErrorCode.NOT_CONNECTED] = strings.notConnected;
  messages[ErrorCode.INVALID_ACTION] = strings.invalidAction;
  messages[ErrorCode.BAD_REPLY] = strings.badReply;
  messages[ErrorCode.CONNECTION_LOST] = strings.connectionLost;
  messages[ErrorCode.ROOM_NOT_FOUND] = strings.roomNotFound;
  return messages;
}
