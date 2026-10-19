import { type SchemaType, schema, t } from "@colyseus/schema";
import { BaseGameState } from "@partygame/shared/schema";

export const ScoreEntry = schema(
  {
    playerId: t.string().default(""),
    name: t.string().default(""),
    hits: t.number().default(0),
  },
  "ScoreEntry",
);
export type ScoreEntry = SchemaType<typeof ScoreEntry>;

export const RushState = BaseGameState.extend(
  {
    /** The target's position in cells on the GRID x GRID field. */
    targetX: t.number().default(0),
    targetY: t.number().default(0),
    /** Total TAPs per player, keyed by playerId. */
    taps: t.map("number"),
    /** TAPs that landed in the center zone, keyed by playerId. */
    hits: t.map("number"),
    /** The scoreboard, best first; written on entering Results. */
    entries: t.array(ScoreEntry),
  },
  "RushState",
);
export type RushState = SchemaType<typeof RushState>;
