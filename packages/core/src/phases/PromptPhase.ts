import type { GameAction } from "@partygame/shared";
import type { PhaseHandler } from "./types.js";

export class PromptPhase implements PhaseHandler {
  handleAction(_player: string, action: GameAction) {
    if (action.type !== "SUBMIT_ANSWER") {
      throw new Error("Invalid Action");
    }
  }
  computeVisibility() {
    return { phase: "Prompting" };
  }
}
