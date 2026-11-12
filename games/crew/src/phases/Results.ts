import { playAgainAction } from "@partygame/core";
import { ACTION } from "../actions.js";
import type { CrewPhase } from "../private.js";

export const Results: CrewPhase = {
  actions: {
    [ACTION.PLAY_AGAIN]: playAgainAction(),
  },
};
