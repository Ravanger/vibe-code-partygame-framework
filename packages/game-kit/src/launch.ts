import type { BaseGameState } from "@partygame/shared/schema";
import { defaultIo } from "./io.js";
import { buildLaunchConfig } from "./launchConfig.js";
import type { GameDeclaration, GameKitIo } from "./types.js";

/** Runs the launcher with the config built from `pkg`; a one-line `launch.ts`. */
export async function launch<TState extends BaseGameState, TContent>(
  pkg: GameDeclaration<TState, TContent>,
  options: { gameDir: string },
  io: GameKitIo = defaultIo(),
): Promise<void> {
  const config = buildLaunchConfig(pkg, options);
  await io.runLauncher(config, io.argv);
}
