import type { BaseGameState } from "@partygame/shared/schema";
import { DemoRun } from "@partygame/terminal";
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
  const flag = io.argv.find((arg) => arg.startsWith("--bots="));
  const bots = flag === undefined ? 3 : Number(flag.split("=")[1]);
  if (!Number.isInteger(bots) || bots < meta.minPlayers - 1 || bots > meta.maxPlayers - 1) {
    io.error(demoUsage(meta));
    io.exit(2);
    return;
  }
  const demo = pkg.demo;
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
}
