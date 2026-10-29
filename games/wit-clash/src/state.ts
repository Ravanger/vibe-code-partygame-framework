import { type SchemaType, schema, t } from "@colyseus/schema";
import { BaseGameState } from "@partygame/shared/schema";

export const CategoryOption = schema(
  {
    id: t.string().default(""),
    name: t.string().default(""),
    emoji: t.string().default(""),
    votes: t.number().default(0),
  },
  "CategoryOption",
);
export type CategoryOption = SchemaType<typeof CategoryOption>;

export const Answer = schema(
  {
    id: t.string().default(""),
    text: t.string().default(""),
    votes: t.number().default(0),
    authorId: t.string().default(""),
    authorName: t.string().default(""),
    isWinner: t.boolean().default(false),
  },
  "Answer",
);
export type Answer = SchemaType<typeof Answer>;

export const Matchup = schema(
  {
    id: t.string().default(""),
    index: t.number().default(0),
    promptText: t.string().default(""),
    answers: t.array(Answer),
    isRevealed: t.boolean().default(false),
    isForfeit: t.boolean().default(false),
    isClash: t.boolean().default(false),
  },
  "Matchup",
);
export type Matchup = SchemaType<typeof Matchup>;

export const ScoreEntry = schema(
  {
    playerId: t.string().default(""),
    name: t.string().default(""),
    score: t.number().default(0),
    roundPoints: t.number().default(0),
    matchupsWon: t.number().default(0),
    hadClash: t.boolean().default(false),
    wonTieBreaker: t.boolean().default(false),
    hasLeft: t.boolean().default(false),
  },
  "ScoreEntry",
);
export type ScoreEntry = SchemaType<typeof ScoreEntry>;

export const BestAnswer = schema(
  {
    text: t.string().default(""),
    authorId: t.string().default(""),
    authorName: t.string().default(""),
    promptText: t.string().default(""),
    votes: t.number().default(0),
  },
  "BestAnswer",
);
export type BestAnswer = SchemaType<typeof BestAnswer>;

export const HighlightAnswer = schema(
  {
    authorName: t.string().default(""),
    text: t.string().default(""),
    votes: t.number().default(0),
  },
  "HighlightAnswer",
);
export type HighlightAnswer = SchemaType<typeof HighlightAnswer>;

/** One card of the post-game highlight reel: a matchup's prompt and its answers. */
export const Highlight = schema(
  {
    kind: t.string().default(""),
    promptText: t.string().default(""),
    answers: t.array(HighlightAnswer),
  },
  "Highlight",
);
export type Highlight = SchemaType<typeof Highlight>;

export const Award = schema(
  {
    id: t.string().default(""),
    title: t.string().default(""),
    winnerNames: t.array("string"),
    detail: t.string().default(""),
  },
  "Award",
);
export type Award = SchemaType<typeof Award>;

export const PromptAssignment = schema(
  {
    matchupId: t.string().default(""),
    promptText: t.string().default(""),
    submitted: t.boolean().default(false),
  },
  "PromptAssignment",
);
export type PromptAssignment = SchemaType<typeof PromptAssignment>;

export const PlayerPrivate = schema(
  {
    prompts: t.array(PromptAssignment),
    categoryVote: t.string().default(""),
    matchupVote: t.string().default(""),
    /** The authorId I voted for in the honor vote; empty when I have not (or cannot) voted. */
    honorVote: t.string().default(""),
    canVote: t.boolean().default(false),
    isOwnMatchup: t.boolean().default(false),
    ownAnswerId: t.string().default(""),
  },
  "PlayerPrivate",
);
export type PlayerPrivate = SchemaType<typeof PlayerPrivate>;

export const WitClashState = BaseGameState.extend(
  {
    categoryOptions: t.array(CategoryOption),
    selectedCategory: t.string().default(""),
    roundNumber: t.number().default(0),
    totalRounds: t.number().default(3),
    isFinalRound: t.boolean().default(false),
    matchups: t.array(Matchup),
    activeMatchupIndex: t.number().default(-1),
    votesCast: t.number().default(0),
    votesExpected: t.number().default(0),
    progress: t.map("number"),
    answersPerPlayer: t.number().default(0),
    /** Answers refused by the text filter since the game started; the host sees this count, never the text. */
    rejectedTexts: t.number().default(0),
    scoreboard: t.array(ScoreEntry),
    tieBreakers: t.array(Matchup),
    tieBreakerContenders: t.array("string"),
    bestAnswers: t.array(BestAnswer),
    highlights: t.array(Highlight),
    awards: t.array(Award),
    /** The honor-vote winner names, for the ceremony; empty when there was no (or no result of a) honor vote. */
    honorWinnerNames: t.array("string"),
    typing: t.map("boolean"),
    mine: t.map(PlayerPrivate).view(),
  },
  "WitClashState",
);
export type WitClashState = SchemaType<typeof WitClashState>;

/** The WitClashState fields every client may see; `mine` is `.view()`-only. */
export const WITCLASH_PUBLIC_FIELDS = [
  "categoryOptions",
  "selectedCategory",
  "roundNumber",
  "totalRounds",
  "isFinalRound",
  "matchups",
  "activeMatchupIndex",
  "votesCast",
  "votesExpected",
  "progress",
  "answersPerPlayer",
  "rejectedTexts",
  "scoreboard",
  "tieBreakers",
  "tieBreakerContenders",
  "bestAnswers",
  "highlights",
  "awards",
  "honorWinnerNames",
  "typing",
] as const;
