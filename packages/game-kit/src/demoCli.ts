import type { BaseGameState } from "@partygame/shared/schema";
import { DemoRun, parseDemoArgs } from "@partygame/terminal";
import { failWith } from "./fail.js";
import { hostedGame } from "./hostedGame.js";
import { defaultIo } from "./io.js";
import type { GameDeclaration, GameKitIo, GameMeta } from "./types.js";

/** The usage line for the `demo` command, bounded by the game's seats. */
const demoUsage = (meta: GameMeta): string =>
  `Usage: bun run demo [--bots=${meta.minPlayers - 1}..${meta.maxPlayers - 1}]`;

/** The `demo` entry: one all-bot game on its own server, with a PASS/FAIL verdict. */
export async function demoCli<TState extends BaseGameState, TContent>(
  pkg: GameDeclaration<TState, TContent>,
  io: GameKitIo = defaultIo(),
): Promise<void> {
  const meta = pkg.meta;
  const parsed = parseDemoArgs(io.argv, {
    minBots: meta.minPlayers - 1,
    maxBots: meta.maxPlayers - 1,
    usage: demoUsage(meta),
  });
  if (!parsed.ok) {
    io.error(parsed.error);
    io.exit(2);
    return;
  }
  const { bots } = parsed.value;
  const demo = pkg.demo;
  try {
    const passed = await new DemoRun<TState>({
      games: [hostedGame(pkg, await pkg.load?.(io.env))],
      kit: demo?.kit ?? pkg.botKit,
      bots,
      ...(demo?.roomOptions !== undefined ? { roomOptions: demo.roomOptions } : {}),
      ...(demo?.hostName !== undefined ? { hostName: demo.hostName } : {}),
      bot: { log: io.log, ...demo?.bot },
      finished: pkg.isFinished,
      ...(demo?.narrate !== undefined ? { narrate: demo.narrate } : {}),
      ...(demo?.problems !== undefined ? { problems: demo.problems } : {}),
      ...(demo?.passMessage !== undefined ? { passMessage: demo.passMessage } : {}),
      out: io.log,
    }).run();
    io.exit(passed ? 0 : 1);
  } catch (error) {
    failWith(io, error);
  }
}
