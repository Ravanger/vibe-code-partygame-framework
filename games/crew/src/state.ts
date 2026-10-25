import { type SchemaType, schema, t } from "@colyseus/schema";
import { BaseGameState } from "@partygame/shared/schema";

export const ChoiceEntry = schema(
  {
    playerId: t.string().default(""),
    name: t.string().default(""),
    choice: t.string().default(""),
  },
  "ChoiceEntry",
);
export type ChoiceEntry = SchemaType<typeof ChoiceEntry>;

export const GuessEntry = schema(
  {
    playerId: t.string().default(""),
    name: t.string().default(""),
    value: t.number().default(0),
    correct: t.boolean().default(false),
  },
  "GuessEntry",
);
export type GuessEntry = SchemaType<typeof GuessEntry>;

export const RevealEntry = schema(
  {
    playerId: t.string().default(""),
    name: t.string().default(""),
    signal: t.number().default(0),
  },
  "RevealEntry",
);
export type RevealEntry = SchemaType<typeof RevealEntry>;

export const PlayerPrivate = schema({ signal: t.number().default(0) }, "PlayerPrivate");
export type PlayerPrivate = SchemaType<typeof PlayerPrivate>;

export const CrewState = BaseGameState.extend(
  {
    round: t.number().default(0),
    totalRounds: t.number().default(0),
    roles: t.map("string"),
    /** The crew's public knowledge: every signal revealed so far, by sharing or by leaving. */
    reveals: t.array(RevealEntry),
    choices: t.array(ChoiceEntry),
    guesses: t.array(GuessEntry),
    outcome: t.string().default(""),
    target: t.number().default(0),
    mine: t.map(PlayerPrivate).view(),
  },
  "CrewState",
);
export type CrewState = SchemaType<typeof CrewState>;

/** The CrewState fields every client may see; `mine` is `.view()`-only. */
export const CREW_PUBLIC_FIELDS = [
  "round",
  "totalRounds",
  "roles",
  "reveals",
  "choices",
  "guesses",
  "outcome",
  "target",
] as const;
