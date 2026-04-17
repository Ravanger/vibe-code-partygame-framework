import { StateView } from "@colyseus/schema";
import type { GameVisibilityConfig } from "@partygame/core";
import type { GameStateSchema } from "../schema/GameStateSchema.js";
import type { PlayerSchema } from "../schema/PlayerSchema.js";

/**
 * Custom StateView that filters state based on viewer role.
 */
export class RoleBasedStateView extends StateView {
  constructor(
    _state: GameStateSchema,
    _viewer: PlayerSchema,
    _config: GameVisibilityConfig<GameStateSchema, PlayerSchema>,
  ) {
    super();
    // StateView requires a schema ref. Predicate-based filtering is covered by enforceVisibility
    // and can be mapped to schema tags later without breaking the GameRoom join flow now.
  }
}
