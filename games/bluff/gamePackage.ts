import { createTextFilter } from "@partygame/content/filter";
import { defineGamePackage } from "@partygame/game-kit";
import { bluffKit } from "./bots/bluffBot.js";
import { createBluffGame } from "./src/game.js";
import { isGameOver } from "./src/isGameOver.js";
import { contentDir, loadContent } from "./src/loadContent.js";
import { META } from "./src/meta.js";
import { BLUFF_PUBLIC_FIELDS, BluffState } from "./src/state.js";
import { bluffTerminal } from "./terminal/bluffTerminal.js";
import { bluffCommentator } from "./terminal/Narrator.js";

/** The bluff game declared once: content loads from `content/`, the entry files are stubs over this. */
export const gamePackage = defineGamePackage({
  meta: META,
  displayName: "Bluff",
  load: (env) => loadContent(contentDir(env, import.meta.url)),
  definition: (prompts) => createBluffGame({ prompts }),
  textFilter: createTextFilter(),
  stateClass: BluffState,
  publicFields: BLUFF_PUBLIC_FIELDS,
  isFinished: isGameOver,
  botKit: bluffKit(),
  terminal: bluffTerminal,
  demo: {
    roomOptions: { rounds: 1 },
    bot: { thinkMs: [400, 900], reactMs: [300, 700] },
    commentator: bluffCommentator,
  },
});
