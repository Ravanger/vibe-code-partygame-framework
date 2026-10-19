import { defineGame } from "@partygame/core";
import { Crew } from "./crew.js";
import { META } from "./meta.js";
import { type CrewOptions, CrewOptionsSchema } from "./options.js";
import { PHASE } from "./phaseNames.js";
import { Results } from "./phases/Results.js";
import { Round } from "./phases/Round.js";
import { Verdict } from "./phases/Verdict.js";
import { CrewPrivate } from "./private.js";
import type { CrewState } from "./state.js";

/** The headless crew game: no content or configuration to load. */
export function createCrewGame() {
  return defineGame<CrewState, CrewPrivate, CrewOptions>({
    name: "Crew",
    version: "1",
    minPlayers: META.minPlayers,
    maxPlayers: META.maxPlayers,
    startPhase: PHASE.Round,
    options: CrewOptionsSchema,
    createPrivateState: () => new CrewPrivate(),
    phases: {
      [PHASE.Round]: Round,
      [PHASE.Verdict]: Verdict,
      [PHASE.Results]: Results,
    },
    onReturnToLobby: (ctx) => new Crew(ctx).clearGame(),
  });
}
