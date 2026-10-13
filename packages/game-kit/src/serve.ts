import type { BaseGameState } from "@partygame/shared/schema";
import { hostedGame } from "./hostedGame.js";
import { defaultIo } from "./io.js";
import { servePorts } from "./ports.js";
import type { GameDeclaration, GameKitIo } from "./types.js";

/** Starts the game server for `pkg` on the ports of `io.env`; a one-line `server.ts`. */
export async function serve<TState extends BaseGameState, TContent>(
  pkg: GameDeclaration<TState, TContent>,
  _options: { gameDir: string },
  io: GameKitIo = defaultIo(),
): Promise<unknown> {
  const content = await pkg.load?.(io.env);
  const hosted = hostedGame(pkg, content);
  const start = io.startServer ?? (await import("@partygame/server/bun")).startServer;
  return start({ games: [hosted], ...servePorts(io.env) });
}
