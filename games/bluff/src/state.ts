import { type SchemaType, schema, t } from "@colyseus/schema";
import { BaseGameState } from "@partygame/shared/schema";

export const BluffOption = schema(
  {
    id: t.string().default(""),
    text: t.string().default(""),
    votes: t.number().default(0),
    authorName: t.string().default(""),
  },
  "BluffOption",
);
export type BluffOption = SchemaType<typeof BluffOption>;

export const RevealEntry = schema(
  {
    playerId: t.string().default(""),
    name: t.string().default(""),
    roundPoints: t.number().default(0),
    fooledCount: t.number().default(0),
    guessedTruth: t.boolean().default(false),
  },
  "RevealEntry",
);
export type RevealEntry = SchemaType<typeof RevealEntry>;

export const ScoreEntry = schema(
  {
    playerId: t.string().default(""),
    name: t.string().default(""),
    score: t.number().default(0),
    hasLeft: t.boolean().default(false),
  },
  "ScoreEntry",
);
export type ScoreEntry = SchemaType<typeof ScoreEntry>;

export const PlayerPrivate = schema({ myOptionId: t.string().default("") }, "PlayerPrivate");
export type PlayerPrivate = SchemaType<typeof PlayerPrivate>;

export const BluffState = BaseGameState.extend(
  {
    promptText: t.string().default(""),
    roundNumber: t.number().default(0),
    totalRounds: t.number().default(0),
    choices: t.array(BluffOption),
    truthRevealedId: t.string().default(""),
    votesCast: t.number().default(0),
    votesExpected: t.number().default(0),
    progress: t.map("boolean"),
    results: t.array(RevealEntry),
    scoreboard: t.array(ScoreEntry),
    mine: t.map(PlayerPrivate).view(),
  },
  "BluffState",
);
export type BluffState = SchemaType<typeof BluffState>;

/** The BluffState fields every client may see; `mine` is `.view()`-only. */
export const BLUFF_PUBLIC_FIELDS = [
  "promptText",
  "roundNumber",
  "totalRounds",
  "choices",
  "truthRevealedId",
  "votesCast",
  "votesExpected",
  "progress",
  "results",
  "scoreboard",
] as const;
