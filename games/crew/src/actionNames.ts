/** Client action names, shared with the UI. Adding one means a schema in actions.ts and an entry in a phase's `actions`. */
export const ACTION = {
  SHARE: "SHARE",
  HOLD: "HOLD",
  GUESS: "GUESS",
  PLAY_AGAIN: "PLAY_AGAIN",
} as const;

/** The range of guess values the Verdict accepts. */
export const GUESS_MIN = 0;
export const GUESS_MAX = 99;
