import { z } from "zod";

export const GameActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SubmitAnswer"), answer: z.string() }),
  z.object({ type: z.literal("CastVote"), answerId: z.string() }),
  z.object({ type: z.literal("AcknowledgeReveal") }),
]);

export type GameAction = z.infer<typeof GameActionSchema>;
