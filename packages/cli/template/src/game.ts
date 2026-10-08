import { defineGame } from "@partygame/core";
import { type __PascalName__Options, __PascalName__OptionsSchema } from "./options.js";
import { PHASE } from "./phaseNames.js";
import { Results } from "./phases/Results.js";
import { Waving } from "./phases/Waving.js";
import { MAX_PLAYERS, MIN_PLAYERS } from "./playerLimits.js";
import { __PascalName__Private } from "./private.js";
import type { __PascalName__State } from "./state.js";

export function create__PascalName__Game() {
  return defineGame<__PascalName__State, __PascalName__Private, __PascalName__Options>({
    name: __DisplayNameJson__,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    startPhase: PHASE.Waving,
    options: __PascalName__OptionsSchema,
    createPrivateState: () => new __PascalName__Private(),
    phases: {
      [PHASE.Waving]: Waving,
      [PHASE.Results]: Results,
    },
  });
}
