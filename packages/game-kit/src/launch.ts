import { runLauncher } from "@partygame/launcher";
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
  const runner = io.runLauncher ?? runLauncher;
  await runner(config, io.argv);
}
