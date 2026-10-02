import { type SchemaType, schema, t } from "@colyseus/schema";
import { PlayerSchema } from "./PlayerSchema.js";

/** Synced state every game shares. Games extend it with `BaseGameState.extend({ ... }, "Name")`. */
export const BaseGameState = schema(
  {
    phase: t.string().default("Lobby"),
    roomCode: t.string().default(""),
    phaseEndsAt: t.number().default(0),
    serverNow: t.number().default(0),
    spectatorCount: t.number().default(0),
    options: t.string().default("{}"),
    notice: t.string().default(""),
    minPlayers: t.number().default(0),
    maxPlayers: t.number().default(0),
    canStart: t.boolean().default(false),
    players: t.map(PlayerSchema),
  },
  "BaseGameState",
);
export type BaseGameState = SchemaType<typeof BaseGameState>;
