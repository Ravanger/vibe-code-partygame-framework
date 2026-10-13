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

/** The `LaunchConfig` a game's `launch.ts` runs. */
export function buildLaunchConfig<TState extends BaseGameState, TContent>(
  pkg: GameDeclaration<TState, TContent>,
  options: { gameDir: string },
): LaunchConfig<TState> {
  const { meta } = pkg;
  return {
    name: pkg.displayName ?? meta.roomName,
    gameDir: options.gameDir,
    bots: { kit: pkg.botKit, max: meta.maxPlayers - 1 },
    demo: {
      min: meta.minPlayers - 1,
      max: meta.maxPlayers - 1,
      create: (connection) => new DemoTable(demoTableOptions(pkg, connection)),
    },
  };
}
