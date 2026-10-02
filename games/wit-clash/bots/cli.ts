import { parseArgs } from "node:util";
import { RoomCodeSchema } from "@partygame/shared";
import { MAX_PLAYERS } from "../src/playerLimits.js";
import { joinBots } from "./joinBots.js";

const USAGE =
  "Usage: bun run bots <CODE> [count=3] [--endpoint ws://localhost:2567] [--api-port 3001]";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    endpoint: { type: "string", default: "ws://localhost:2567" },
    "api-port": { type: "string", default: "3001" },
  },
});

const code = RoomCodeSchema.safeParse((positionals[0] ?? "").toUpperCase());
const count = Number(positionals[1] ?? "3");
const apiPort = Number(values["api-port"]);
if (
  !code.success ||
  !Number.isInteger(count) ||
  count < 1 ||
  count > MAX_PLAYERS - 1 ||
  !(apiPort > 0)
) {
  console.error(`${USAGE}\nCODE is 4 letters; count is 1 to ${MAX_PLAYERS - 1}.`);
  process.exit(1);
}

const bots = await joinBots({
  code: code.data,
  count,
  endpoint: values.endpoint,
  apiPort,
  bot: { log: (line) => console.log(line) },
}).catch((error: unknown) => {
  console.error(`Could not join ${code.data}: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});

for (const bot of bots) console.log(`${bot.name} joined ${code.data}`);
console.log("Bots are playing. Ctrl+C removes them.");

process.on("SIGINT", async () => {
  await Promise.all(bots.map((bot) => bot.leave()));
  process.exit(0);
});
