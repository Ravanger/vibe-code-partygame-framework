import { GameVisibilityConfig } from "./types.js";
import { PlayerSchema } from "../../server/src/schema/PlayerSchema.js";
import { GameStateSchema } from "../../server/src/schema/GameStateSchema.js";

/**
 * Utility to enforce visibility rules based on predicates.
 */
export function enforceVisibility(state: GameStateSchema, viewer: PlayerSchema, config: GameVisibilityConfig): Partial<GameStateSchema> {
  const filteredState = { ...state } as any;

  for (const [key, predicate] of Object.entries(config)) {
    if (!predicate(state, viewer)) {
      delete filteredState[key];
    }
  }

  return filteredState as Partial<GameStateSchema>;
}
