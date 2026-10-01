import { z } from "zod";

/** The single source of defaults and limits for the room options, on the server and in the lobby settings UI. */
export const WitClashOptionsSchema = z.object({
  totalRounds: z.number().int().min(1).max(10).default(3),
  categoryVoteSeconds: z.number().int().min(5).max(300).default(60),
  promptSeconds: z.number().int().min(15).max(600).default(90),
  voteSeconds: z.number().int().min(5).max(120).default(20),
  revealSeconds: z.number().int().min(1).max(30).default(5),
});

export type WitClashOptions = z.output<typeof WitClashOptionsSchema>;

export const DEFAULT_OPTIONS: WitClashOptions = WitClashOptionsSchema.parse({});
