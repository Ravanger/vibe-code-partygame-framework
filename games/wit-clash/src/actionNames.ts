/** Client action names, shared with the UI. Adding one means a schema in actions.ts and an entry in a phase's `actions`. */
export const ACTION = {
  VOTE_CATEGORY: "VOTE_CATEGORY",
  SUBMIT_ANSWER: "SUBMIT_ANSWER",
  CAST_VOTE: "CAST_VOTE",
  NEXT_ROUND: "NEXT_ROUND",
  PLAY_AGAIN: "PLAY_AGAIN",
  SET_TYPING: "SET_TYPING",
  END_GAME: "END_GAME",
} as const;

export type ActionName = (typeof ACTION)[keyof typeof ACTION];

export const ANSWER_MAX_LENGTH = 200;
