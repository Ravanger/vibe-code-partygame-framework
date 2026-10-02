import { fileURLToPath } from "node:url";
import { runLauncher } from "@partygame/launcher";
import { witClashKit } from "./bots/witClashBot.js";
import { MAX_PLAYERS, MIN_PLAYERS } from "./src/playerLimits.js";
import { createDemoTable, DEMO_BOT_OPTIONS, DEMO_NEXT_ROUND_MS } from "./terminal/DemoTable.js";

await runLauncher(
  {
    name: "WitClash",
    gameDir: fileURLToPath(new URL(".", import.meta.url)),
    bots: { kit: witClashKit(), max: MAX_PLAYERS - 1 },
    demo: {
      min: MIN_PLAYERS - 1,
      max: MAX_PLAYERS - 1,
      create: ({ bot, ...connection }) =>
        createDemoTable({
          ...connection,
          bot: { ...DEMO_BOT_OPTIONS, ...bot },
          nextRoundDelayMs: DEMO_NEXT_ROUND_MS,
        }),
    },
  },
  process.argv.slice(2),
);
