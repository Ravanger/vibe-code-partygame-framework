import { createInterface } from "node:readline/promises";
import type { BaseGameState } from "@partygame/shared/schema";
import {
  PlaySession,
  type PlaySessionOptions,
  parsePlayArgs,
  ReadlinePrompter,
  TerminalPlayer,
} from "@partygame/terminal";
import { hostedGame } from "./hostedGame.js";
import { defaultIo } from "./io.js";
import type { GameDeclaration, GameKitIo } from "./types.js";

/** The `play` entry: one human at a terminal, optionally with bots; exit 2 on bad args, 1 on failure. */
export async function play<TState extends BaseGameState, TContent>(
  pkg: GameDeclaration<TState, TContent>,
  io: GameKitIo = defaultIo(),
): Promise<void> {
  const meta = pkg.meta;
  const usage = `Usage: bun run play [--bots=0..${meta.maxPlayers - 1}] [--name=You] [--join=ABCD] [--endpoint=ws://host:2567 --api-port=3001]`;
  const parsed = parsePlayArgs(io.argv, { maxBots: meta.maxPlayers - 1, usage });
  if (!parsed.ok) {
    io.error(parsed.error);
    io.exit(2);
    return;
  }
  const terminal = pkg.terminal;
  if (terminal === undefined) {
    io.error("This game has no terminal strategy.");
    io.exit(1);
    return;
  }
  const content = await pkg.load?.(io.env);
  const options: PlaySessionOptions<TState> = {
    ...parsed.value,
    startServer: parsed.value.usesDefaults && parsed.value.join === undefined,
    kit: pkg.botKit,
    games: [hostedGame(pkg, content)],
    player: (room, playerId, prompter) => new TerminalPlayer(room, playerId, prompter, terminal()),
    clientUrl: "http://localhost:5173",
  };
  let session: PlaySession<TState>;
  if (io.prompter !== undefined) {
    session = new PlaySession(options, io.prompter);
  } else {
    const lines = createInterface({ input: process.stdin, output: process.stdout });
    session = new PlaySession(options, new ReadlinePrompter(lines));
    lines.on("SIGINT", () => session.stop());
    lines.on("close", () => session.stop());
  }
  io.onSignal?.("SIGINT", () => session.stop());
  let code = 0;
  try {
    await session.run();
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    code = 1;
  }
  io.exit(code);
}
