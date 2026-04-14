import { describe, it, expect, vi } from "vitest";
import { enforceVisibility } from "../src/visibility.js";
import { GameStateSchema } from "../../server/src/schema/GameStateSchema.js";
import { PlayerSchema } from "../../server/src/schema/PlayerSchema.js";

describe("enforceVisibility", () => {
  it("filters state based on predicates", () => {
    const state = new GameStateSchema();
    state.publicData = '{"visible": true}';
    state.roomCode = "SECRET";

    const player = new PlayerSchema();
    player.role = "player";

    const config = {
      publicData: () => true,
      roomCode: (s: GameStateSchema, v: PlayerSchema) => v.role === "host",
    };

    const result = enforceVisibility(state, player, config);

    expect(result.publicData).toBe('{"visible": true}');
    expect(result.roomCode).toBeUndefined();
  });
});
