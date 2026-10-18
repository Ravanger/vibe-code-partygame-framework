import { defineGamePackage } from "@partygame/game-kit";
import { bluffKit } from "./bots/bluffBot.js";
import { createBluffGame } from "./src/game.js";
import { isGameOver } from "./src/isGameOver.js";
import { contentDir, loadContent } from "./src/loadContent.js";
import { META } from "./src/meta.js";
import { PHASE } from "./src/phaseNames.js";
import { BluffState } from "./src/state.js";

/** The bluff game declared once: content loads from `content/`, the entry files are stubs over this. */
export const gamePackage = defineGamePackage({
  meta: META,
  displayName: "Bluff",
  load: (env) => loadContent(contentDir(env, import.meta.url)),
  definition: (prompts) => createBluffGame({ prompts }),
  stateClass: BluffState,
  isFinished: isGameOver,
  botKit: bluffKit(),
  demo: {
    roomOptions: { rounds: 1 },
    bot: { thinkMs: [400, 900], reactMs: [300, 700] },
    narrate: (state) => {
      if (state.phase === PHASE.Writing) return [`Writing — ${state.promptText}`];
      if (state.phase === PHASE.Voting) return ["Vote on the real answer"];
      if (state.phase === PHASE.Reveal) {
        const truth = state.choices.find((choice) => choice.id === state.truthRevealedId);
        return [`The truth was: ${truth?.text ?? "?"}`];
      }
      if (state.phase === PHASE.Results) {
        const leader = [...state.scoreboard][0];
        return [
          leader !== undefined ? `Final — ${leader.name} leads with ${leader.score}` : "Final",
        ];
      }
      return [];
    },
  },
});
