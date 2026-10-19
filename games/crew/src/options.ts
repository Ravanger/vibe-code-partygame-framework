import { z } from "zod";

/** The single source of defaults and limits for the room options, on the server and in the lobby settings UI. */
export const CrewOptionsSchema = z.object({
  rounds: z.number().int().min(1).max(5).default(2),
});

export type CrewOptions = z.output<typeof CrewOptionsSchema>;
