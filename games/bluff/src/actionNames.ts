/** Client action names, shared with the UI. Adding one means a schema in actions.ts and an entry in a phase's `actions`. */
export const ACTION = {
  SUBMIT_FAKE: "SUBMIT_FAKE",
  CAST_VOTE: "CAST_VOTE",
  PLAY_AGAIN: "PLAY_AGAIN",
} as const;

/** The longest fake answer a player may submit. */
export const ANSWER_MAX_LENGTH = 200;
