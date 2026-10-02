import { createInterface } from "node:readline/promises";
import { PlaySession, parsePlayArgs, ReadlinePrompter, TerminalPlayer } from "@partygame/terminal";
import { witClashKit } from "../bots/witClashBot.js";
import { witClashGame } from "../src/hostedGame.js";
import { contentDir, loadContent } from "../src/loadContent.js";
import { MAX_PLAYERS } from "../src/playerLimits.js";
import { witClashTerminal } from "./witClashTerminal.js";

const USAGE = `Usage: bun run play [--bots=0..${MAX_PLAYERS - 1}] [--name=You] [--join=ABCD] [--endpoint=ws://host:2567 --api-port=3001]`;

const parsed = parsePlayArgs(process.argv.slice(2), { maxBots: MAX_PLAYERS - 1, usage: USAGE });
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(2);
}

const categories = await loadContent(
  contentDir(process.env, new URL("../server.ts", import.meta.url).href),
);
const lines = createInterface({ input: process.stdin, output: process.stdout });
const { usesDefaults, join } = parsed.value;
const session = new PlaySession(
  {
    ...parsed.value,
    startServer: usesDefaults && join === undefined,
    kit: witClashKit(),
    games: [witClashGame(categories)],
    player: (room, playerId, io) => new TerminalPlayer(room, playerId, io, witClashTerminal()),
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
