import { defineGame } from "@partygame/core";
import { META } from "./meta.js";
import { type RushOptions, RushOptionsSchema } from "./options.js";
import { PHASE } from "./phaseNames.js";
import { Race } from "./phases/Race.js";
import { Results } from "./phases/Results.js";
import { RushPrivate } from "./private.js";
import type { RushState } from "./state.js";

/** The headless rush game: no content or configuration to load. */
export function createRushGame() {
  return defineGame<RushState, RushPrivate, RushOptions>({
    name: "Rush",
    version: "1",
    minPlayers: META.minPlayers,
    maxPlayers: META.maxPlayers,
    startPhase: PHASE.Race,
    options: RushOptionsSchema,
    createPrivateState: () => new RushPrivate(),
    phases: {
      [PHASE.Race]: Race,
      [PHASE.Results]: Results,
    },
    onReturnToLobby: (ctx) => {
      ctx.state.targetX = 0;
      ctx.state.targetY = 0;
      ctx.state.taps.clear();
      ctx.state.hits.clear();
      ctx.state.entries.clear();
    },
  });
}
