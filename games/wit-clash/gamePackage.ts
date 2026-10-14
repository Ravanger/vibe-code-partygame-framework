import { defineGamePackage } from "@partygame/game-kit";
import { witClashKit } from "./bots/witClashBot.js";
import { createWitClashGame } from "./src/game.js";
import { isGameOver } from "./src/isGameOver.js";
import { contentDir, loadContent } from "./src/loadContent.js";
import { META } from "./src/meta.js";
import { WitClashState } from "./src/state.js";
import { Narrator } from "./terminal/Narrator.js";
import { witClashTerminal } from "./terminal/witClashTerminal.js";

const narrator = new Narrator();

/** WitClash declared once: content loads from `content/`, the entry files are stubs over this. */
export const gamePackage = defineGamePackage({
  meta: META,
  displayName: "WitClash",
  load: (env) => loadContent(contentDir(env, import.meta.url)),
  definition: (categories) => createWitClashGame({ categories }),
  stateClass: WitClashState,
  isFinished: isGameOver,
  botKit: witClashKit(),
  terminal: witClashTerminal,
  demo: {
    kit: witClashKit({ nextRoundDelayMs: 8000 }),
    roomOptions: {
      totalRounds: 2,
      categoryVoteSeconds: 8,
      promptSeconds: 20,
      voteSeconds: 8,
      revealSeconds: 6,
    },
    bot: { thinkMs: [2000, 9000], reactMs: [1000, 4000] },
    narrate: (state) => narrator.update(state),
    problems: (state) => narrator.discrepancies(state),
    passMessage: "PASS: scores match the reveals, no action was rejected",
  },
});
