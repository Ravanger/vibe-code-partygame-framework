import type { BaseGameState } from "@partygame/shared/schema";
import { runBotsCommand } from "@partygame/terminal";
import { defaultIo } from "./io.js";
import type { GameDeclaration, GameKitIo, GameMeta } from "./types.js";

/** The usage line for the `bots` command, bounded by the game's seats. */
const botsUsage = (meta: GameMeta): string =>
  `Usage: bun run bots <CODE> [count=3] [--endpoint ws://localhost:2567] [--api-port 3001]\nCODE is 4 letters; count is 1 to ${meta.maxPlayers - 1}.`;

/** The `bots <CODE> [count]` entry: seats bots in a room made elsewhere; the SIGINT handler removes them and exits 0. */
export async function botsCli<TState extends BaseGameState, TContent>(
  pkg: GameDeclaration<TState, TContent>,
  io: GameKitIo = defaultIo(),
): Promise<void> {
  try {
    await runBotsCommand({
      kit: pkg.botKit,
      maxBots: pkg.meta.maxPlayers - 1,
      argv: io.argv,
      out: io.log,
      err: io.error,
      usage: botsUsage(pkg.meta),
      bot: { log: io.log },
      onInterrupt: (stop) => io.onSignal?.("SIGINT", () => void stop().finally(() => io.exit(0))),
    });
  } catch {
    io.exit(1);
  }
}
