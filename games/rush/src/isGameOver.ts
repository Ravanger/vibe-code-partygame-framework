import { PHASE } from "./phaseNames.js";
import type { RushState } from "./state.js";

/** True on the results screen, where the host plays again instead of ending. */
export const isGameOver = (state: RushState): boolean => state.phase === PHASE.Results;
