import { PHASE } from "./phaseNames.js";
import type { BluffState } from "./state.js";

/** True on the results screen, where the host plays again instead of ending. */
export const isGameOver = (state: BluffState): boolean => state.phase === PHASE.Results;
