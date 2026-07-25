import { z } from "zod";

/**
 * Every client -> server game action.
 *
 * Naming convention: SCREAMING_SNAKE_CASE. This must match the action keys in
 * each game's phase definitions (see games/wit-clash/index.ts) exactly.
 */
export const GameActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("START_GAME") }),
  z.object({ type: z.literal("VOTE_CATEGORY"), categoryId: z.string().min(1).max(64) }),
  // matchupId is required: each player is dealt TWO prompts (Plan 08 pairing).
  z.object({
    type: z.literal("SUBMIT_ANSWER"),
    matchupId: z.string().min(1).max(64),
    answer: z.string().trim().min(1).max(200),
  }),
  z.object({ type: z.literal("CAST_VOTE"), answerId: z.string().min(1).max(64) }),
  z.object({ type: z.literal("ACKNOWLEDGE_REVEAL") }),
  z.object({ type: z.literal("NEXT_ROUND") }),
  z.object({ type: z.literal("PLAY_AGAIN") }),
]);

export type GameAction = z.infer<typeof GameActionSchema>;
export type GameActionType = GameAction["type"];
