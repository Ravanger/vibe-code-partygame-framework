/** Longest player name `SET_NAME` accepts, after trimming. */
export const NAME_MAX_LENGTH = 20;

/** Most playerIds the `seats` room option may list; a room also rejects more than its game's `maxPlayers`. */
export const MAX_SEATS = 64;

/** Longest `JSON.stringify` of a room's options, checked at room creation and in `SET_OPTIONS`. */
export const MAX_OPTIONS_JSON_LENGTH = 4096;

/** How many letters a room code has. */
export const ROOM_CODE_LENGTH = 4;

/** The alphabet room codes are drawn from. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const NON_ROOM_CODE_CHARACTERS = new RegExp(`[^${ROOM_CODE_ALPHABET}]`, "g");

/** Uppercases `raw`, keeps only room-code characters and cuts to the code length. */
export function sanitizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(NON_ROOM_CODE_CHARACTERS, "").slice(0, ROOM_CODE_LENGTH);
}
