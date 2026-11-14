import { PHASE } from "../src/phaseNames.js";
import type { BluffState } from "../src/state.js";

/** The bluff demo's commentator: one line for each game phase, nothing outside them. */
export const bluffCommentator = () => ({
  narrate: (state: BluffState): readonly string[] => {
    if (state.phase === PHASE.Writing) return [`Writing — ${state.promptText}`];
    if (state.phase === PHASE.Voting) return ["Vote on the real answer"];
    if (state.phase === PHASE.Reveal) {
      const truth = state.choices.find((choice) => choice.id === state.truthRevealedId);
      return [`The truth was: ${truth?.text ?? "?"}`];
    }
    if (state.phase === PHASE.Results) {
      const leader = [...state.scoreboard][0];
      return [leader !== undefined ? `Final — ${leader.name} leads with ${leader.score}` : "Final"];
    }
    return [];
  },
});
