import { z } from "zod";

/** The single source of defaults and limits for the room options, on the server and in the lobby settings UI. */
export const __PascalName__OptionsSchema = z.object({
  waveGoal: z.number().int().min(1).max(100).default(10),
});

export type __PascalName__Options = z.output<typeof __PascalName__OptionsSchema>;
