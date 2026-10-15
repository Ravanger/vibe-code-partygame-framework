import type { BaseGameState } from "@partygame/shared/schema";
import {
  PlaySession,
  type PlaySessionOptions,
  parsePlayArgs,
  TerminalPlayer,
} from "@partygame/terminal";
import { failWith } from "./fail.js";
import { hostedGame } from "./hostedGame.js";
import { defaultIo } from "./io.js";
import { startsServer } from "./startsServer.js";
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
  let session: PlaySession<TState> | undefined;
  try {
    const options: PlaySessionOptions<TState> = {
      ...parsed.value,
      startServer: startsServer(parsed.value),
      kit: pkg.botKit,
      games: [hostedGame(pkg, await pkg.load?.(io.env))],
      player: (room, playerId, prompter) =>
        new TerminalPlayer(room, playerId, prompter, terminal()),
      clientUrl: "http://localhost:5173",
    };
    const stop = () => session?.stop();
    session = new PlaySession(options, io.prompter(stop));
    io.onSignal("SIGINT", stop);
    await session.run();
  } catch (error) {
    failWith(io, error);
    return;
  }
  io.exit(0);
}
