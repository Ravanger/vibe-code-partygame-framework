import { z } from "zod";

/** The single source of defaults and limits for the room options, on the server and in the lobby settings UI. */
export const WitClashOptionsSchema = z.object({
  /** free plays the host-editable content with a category vote; daily plays the repo-shipped canon on a day-seeded order. */
  mode: z.enum(["free", "daily"]).default("free"),
  totalRounds: z.number().int().min(1).max(10).default(3),
  categoryVoteSeconds: z.number().int().min(5).max(300).default(60),
  promptSeconds: z.number().int().min(15).max(600).default(90),
  voteSeconds: z.number().int().min(5).max(120).default(20),
  revealSeconds: z.number().int().min(1).max(30).default(5),
  /** Insert an optional "funniest answer" player vote before the final Results. */
  honorVote: z.boolean().default(false),
  /** How strictly answers and names are filtered. */
  filterLevel: z.enum(["off", "moderate", "strict"]).default("moderate"),
  /** Which categories free play may offer: "any" includes mature ones, "family" never does. */
  contentRating: z.enum(["any", "family"]).default("any"),
});

export type WitClashOptions = z.output<typeof WitClashOptionsSchema>;

export const DEFAULT_OPTIONS: WitClashOptions = WitClashOptionsSchema.parse({});
