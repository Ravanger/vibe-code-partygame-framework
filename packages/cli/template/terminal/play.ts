import { createInterface } from "node:readline/promises";
import { PlaySession, parsePlayArgs, ReadlinePrompter, TerminalPlayer } from "@partygame/terminal";
import { __camelName__Kit } from "../bots/__camelName__Bot.js";
import { __camelName__Game } from "../src/hostedGame.js";
import { MAX_PLAYERS } from "../src/playerLimits.js";
import { __camelName__Terminal } from "./__camelName__Terminal.js";

const USAGE = `Usage: bun run play [--bots=0..${MAX_PLAYERS - 1}] [--name=You] [--join=ABCD] [--endpoint=ws://host:2567 --api-port=3001]`;

const parsed = parsePlayArgs(process.argv.slice(2), { maxBots: MAX_PLAYERS - 1, usage: USAGE });
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(2);
}

const lines = createInterface({ input: process.stdin, output: process.stdout });
const { usesDefaults, join } = parsed.value;
const session = new PlaySession(
  {
    ...parsed.value,
    startServer: usesDefaults && join === undefined,
    kit: __camelName__Kit(),
    games: [__camelName__Game()],
    player: (room, playerId, io) => new TerminalPlayer(room, playerId, io, __camelName__Terminal()),
    clientUrl: "http://localhost:5173",
  },
  new ReadlinePrompter(lines),
);
lines.on("SIGINT", () => session.stop());
lines.on("close", () => session.stop());
process.on("SIGINT", () => session.stop());

let code = 0;
try {
  await session.run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  code = 1;
}
lines.close();
process.exit(code);
