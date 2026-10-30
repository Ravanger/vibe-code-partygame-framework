import { z } from "zod";

/** One option of every kind the settings form renders: bounded integers, stepped numbers, booleans, string enums and strings. */
export const TestOptionsSchema = z.object({
  turnSeconds: z.number().int().min(5).max(60).default(20),
  tolerance: z.number().min(0).max(1).multipleOf(0.1).default(0.5),
  soundOn: z.boolean().default(true),
  level: z.enum(["off", "moderate", "strict"]).default("moderate"),
  label: z.string().max(24).default("x"),
});

export const TEST_DEFAULTS = {
  turnSeconds: 20,
  tolerance: 0.5,
  soundOn: true,
  level: "moderate",
  label: "x",
};
