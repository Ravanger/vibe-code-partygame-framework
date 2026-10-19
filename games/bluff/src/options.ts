import { z } from "zod";

/** The single source of defaults and limits for the room options, on the server and in the lobby settings UI. */
export const BluffOptionsSchema = z.object({
  rounds: z.number().int().min(1).max(10).default(3),
  writingSeconds: z.number().int().min(10).max(300).default(45),
  votingSeconds: z.number().int().min(5).max(120).default(30),
  revealSeconds: z.number().int().min(1).max(60).default(15),
});

export type BluffOptions = z.output<typeof BluffOptionsSchema>;

/** The parsed schema defaults; the client falls back to these when `state.options` is missing. */
export const DEFAULT_OPTIONS = BluffOptionsSchema.parse({});
