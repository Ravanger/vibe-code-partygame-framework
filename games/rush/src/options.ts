import { z } from "zod";

/** The single source of defaults and limits for room options, on the server and in the lobby settings UI. */
export const RushOptionsSchema = z.object({
  raceSeconds: z.number().int().min(5).max(30).default(10),
});

export type RushOptions = z.output<typeof RushOptionsSchema>;
