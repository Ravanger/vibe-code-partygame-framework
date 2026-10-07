import { PHASE } from "./phaseNames.js";
import type { __PascalName__State } from "./state.js";

/** True on the results screen, where the host plays again instead of ending. */
export const isGameOver = (state: __PascalName__State): boolean => state.phase === PHASE.Results;
