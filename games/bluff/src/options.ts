import { z } from "zod";

/** The single source of defaults and limits for the room options, on the server and in the lobby settings UI. */
export const BluffOptionsSchema = z.object({
  rounds: z.number().int().min(1).max(10).default(3),
});

export type BluffOptions = z.output<typeof BluffOptionsSchema>;
