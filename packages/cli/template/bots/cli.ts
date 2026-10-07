import { runBotsCommand } from "@partygame/terminal";
import { MAX_PLAYERS } from "../src/playerLimits.js";
import { __camelName__Kit } from "./__camelName__Bot.js";

const USAGE = `Usage: bun run bots <CODE> [count=3] [--endpoint ws://localhost:2567] [--api-port 3001]
CODE is 4 letters; count is 1 to ${MAX_PLAYERS - 1}.`;

try {
  await runBotsCommand({
    kit: __camelName__Kit(),
    maxBots: MAX_PLAYERS - 1,
    argv: process.argv.slice(2),
    out: console.log,
    err: console.error,
    usage: USAGE,
    bot: { log: console.log },
    onInterrupt: (stop) => process.on("SIGINT", () => void stop().finally(() => process.exit(0))),
  });
} catch {
  process.exit(1);
}
