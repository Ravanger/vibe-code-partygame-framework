import type { BaseGameState } from "@partygame/shared/schema";
import { failWith } from "./fail.js";
import { hostedGame } from "./hostedGame.js";
import { defaultIo } from "./io.js";
import type { GameDeclaration, GameKitIo } from "./types.js";

/** Starts the game server for `pkg` with the ports resolved by the starter from `PORT` and `API_PORT`; a one-line `server.ts`. */
export async function serve<TState extends BaseGameState, TContent>(
  pkg: GameDeclaration<TState, TContent>,
  io: GameKitIo = defaultIo(),
): Promise<unknown> {
  try {
    const hosted = hostedGame(pkg, await pkg.load?.(io.env));
    return await io.startServer({ games: [hosted] });
  } catch (error) {
    failWith(io, error);
    return undefined;
  }
}
