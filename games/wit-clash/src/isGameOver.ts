import { PHASE } from "./phaseNames.js";
import type { WitClashState } from "./state.js";

/** True on the final round's results. */
export const isGameOver = (state: WitClashState): boolean =>
  state.phase === PHASE.Results && state.isFinalRound;
