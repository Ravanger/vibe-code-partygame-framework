import { CLIENT_MESSAGES, type ErrorCode, ROOM_CODE_LENGTH } from "@partygame/shared";

/**
 * Every piece of text the client side owns: the error-code table plus the messages
 * {@link GameConnectionManager} builds itself. A game passes a partial table to the manager's
 * `strings` option; unspecified keys keep the English default.
 */
export interface ClientStrings {
  /**
   * Text per {@link ErrorCode}, used both for failures the client reports on its own and as a
   * replacement for a server error's `message` when the table names that code; otherwise the
   * received message is kept.
   */
  errors?: Partial<Record<ErrorCode, string>>;
  /** Thrown when `join` is called with a code that is not four letters A-Z. */
  invalidRoomCode: string;
  /** Recorded when the room closes before its first state arrives. */
  disconnectedBeforeState: string;
  /** Recorded when the first state does not arrive within the sync timeout. */
  syncTimeout: string;
}

/** The English defaults for every client-owned string; `errors` mirrors {@link CLIENT_MESSAGES}. */
export const defaultClientStrings: ClientStrings = {
  errors: CLIENT_MESSAGES,
  invalidRoomCode: `Game code must be ${ROOM_CODE_LENGTH} letters (A-Z)`,
  disconnectedBeforeState: "Disconnected before the game state arrived",
  syncTimeout: "Timed out waiting for the game state",
};
