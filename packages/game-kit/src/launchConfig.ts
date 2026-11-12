import { type BotConnection, DemoTable, type DemoTableOptions } from "@partygame/bots";
import type { LaunchConfig } from "@partygame/launcher";
import type { BaseGameState } from "@partygame/shared/schema";
import type { GameDeclaration } from "./types.js";

/** The `DemoTable` options the launch demo builds for one connection. */
export function demoTableOptions<TState extends BaseGameState, TContent>(
  pkg: GameDeclaration<TState, TContent>,
  connection: BotConnection & { bots: number },
): DemoTableOptions<TState> {
  const kit = pkg.demo?.kit ?? pkg.botKit;
  if (kit === undefined) throw new Error("demoTableOptions: the declaration has no bot kit");
  return {
    ...connection,
    ...kit,
    bots: connection.bots,
    isFinished: pkg.isFinished,
    ...(pkg.demo?.roomOptions !== undefined ? { roomOptions: pkg.demo.roomOptions } : {}),
    ...(pkg.demo?.hostName !== undefined ? { hostName: pkg.demo.hostName } : {}),
    ...(connection.bot !== undefined || pkg.demo?.bot !== undefined
      ? { bot: { ...pkg.demo?.bot, ...connection.bot } }
      : {}),
  };
}

/**
 * The `LaunchConfig` a game's `launch.ts` runs. The bot and demo sections are omitted when the
 * declaration resolves no kit (`botKit`, or `demo.kit` for the demo); asking the launcher for
 * `--bots`/`--demo` then fails with "<name> has no bots"/"has no demo".
 */
export function buildLaunchConfig<TState extends BaseGameState, TContent>(
  pkg: GameDeclaration<TState, TContent>,
  options: { gameDir: string },
): LaunchConfig<TState> {
  const { meta } = pkg;
  const kit = pkg.botKit;
  return {
    name: pkg.displayName ?? meta.roomName,
    gameDir: options.gameDir,
    ...(kit !== undefined ? { bots: { kit, max: meta.maxPlayers - 1 } } : {}),
    ...((pkg.demo?.kit ?? kit) !== undefined
      ? {
          demo: {
            min: meta.minPlayers - 1,
            max: meta.maxPlayers - 1,
            create: (connection) => new DemoTable(demoTableOptions(pkg, connection)),
          },
        }
      : {}),
  };
}
