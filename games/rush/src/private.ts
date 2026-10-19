import type { PhaseDefinition } from "@partygame/core";
import type { RushOptions } from "./options.js";
import type { RushState } from "./state.js";

export type RushPhase = PhaseDefinition<RushState, RushPrivate, RushOptions>;

/** Server-only state: the target's velocity in cells/s, re-derived from the seed on replay. */
export class RushPrivate {
  vx = 0;
  vy = 0;
}
