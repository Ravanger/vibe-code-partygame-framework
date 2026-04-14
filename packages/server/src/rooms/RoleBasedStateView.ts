import { StateView } from "@colyseus/schema";
import { enforceVisibility } from "@partygame/core";
import { GameStateSchema } from "../schema/GameStateSchema.js";
import { PlayerSchema } from "../schema/PlayerSchema.js";

/**
 * Custom StateView that filters state based on viewer role.
 */
export class RoleBasedStateView extends StateView {
  constructor(state: GameStateSchema, viewer: PlayerSchema, config: any) {
    super();
    // Colyseus StateView uses `.add` to define what to sync.
    // enforceVisibility returns a filtered object.
    const visibleState = enforceVisibility(state, viewer, config);
    this.add(visibleState as any, 1);
  }
}
