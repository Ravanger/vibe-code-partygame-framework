import type { BaseGameState } from "@partygame/shared/schema";
import { parseLaunchArgs } from "./LaunchArgs.js";
import { Launcher } from "./Launcher.js";
import type { LaunchConfig } from "./types.js";

/**
 * Entry point of a game's `launch.ts`: parses `argv` (without the executable and script), starts the launch,
 * stops it on Ctrl+C and exits 1 when anything fails. Resolves once the game is being served.
 */
export async function runLauncher<TState extends BaseGameState>(
  config: LaunchConfig<TState>,
  argv: string[],
  /** Injectable process exit for tests; defaults to `process.exit`. */
  deps: { exit?: (code: number) => void } = {},
): Promise<void> {
  const exitProcess = deps.exit ?? process.exit;
  const parsed = parseLaunchArgs(argv, config);
  if (!parsed.ok) {
    console.error(parsed.error);
    exitProcess(2);
    return;
  }
  let exiting = false;
  const exit = (code: number): void => {
    if (exiting) return;
    exiting = true;
    launcher.stop().finally(() => exitProcess(code));
  };
  const fail = (message: string): void => {
    console.error(`[Launch] ${message}`);
    exit(1);
  };
  const launcher = new Launcher(config, fail);
  process.on("SIGINT", () => exit(0));
  process.on("SIGTERM", () => exit(0));
  await launcher
    .start(parsed.value)
    .catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
}
