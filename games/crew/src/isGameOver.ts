import { PHASE } from "./phaseNames.js";
import type { CrewState } from "./state.js";

/** True on the results screen, where the host plays again instead of ending. */
export const isGameOver = (state: CrewState): boolean => state.phase === PHASE.Results;
