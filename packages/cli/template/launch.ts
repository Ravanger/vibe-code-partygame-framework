import { fileURLToPath } from "node:url";
import { DemoTable } from "@partygame/bots";
import { runLauncher } from "@partygame/launcher";
import { __camelName__Kit } from "./bots/__camelName__Bot.js";
import { PHASE } from "./src/phaseNames.js";
import { MAX_PLAYERS, MIN_PLAYERS } from "./src/playerLimits.js";

const kit = __camelName__Kit();

await runLauncher(
  {
    name: __DisplayNameJson__,
    gameDir: fileURLToPath(new URL(".", import.meta.url)),
    bots: { kit, max: MAX_PLAYERS - 1 },
    demo: {
      min: MIN_PLAYERS - 1,
      max: MAX_PLAYERS - 1,
      create: ({ bot, bots, ...connection }) =>
        new DemoTable({
          ...connection,
          roomName: kit.roomName,
          stateClass: kit.stateClass,
          strategy: kit.strategy,
          bots,
          isFinished: (state) => state.phase === PHASE.Results,
          ...(bot ? { bot } : {}),
        }),
    },
  },
  process.argv.slice(2),
);
