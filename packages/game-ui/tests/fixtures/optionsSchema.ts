import { z } from "zod";

export const TestOptionsSchema = z.object({
  turnSeconds: z.number().int().min(5).max(60).default(20),
  label: z.string().default("x"),
  loose: z.number().default(1),
});

export const TEST_DEFAULTS = { turnSeconds: 20, label: "x", loose: 1 };
