import type { BaseGameState } from "@partygame/shared/schema";
import { parseLaunchArgs } from "./LaunchArgs.js";
import { Launcher } from "./Launcher.js";
import type { LaunchConfig } from "./types.js";

/**
 * Entry point of a game's `launch.ts`: parses `argv` (without the executable and script), starts the launch and
 * resolves once the game is being served. Stops everything on Ctrl+C or a closed terminal, kills every spawned
 * process when the launcher crashes or the process exits, and exits 1 when anything fails.
 */
export async function runLauncher<TState extends BaseGameState>(
  config: LaunchConfig<TState>,
  argv: string[],
  /** Injectable process exit and signal registration for tests; default to `process.exit` and `process.on`. */
  deps: {
    exit?: (code: number) => void;
    on?: (name: string, listener: (...args: unknown[]) => void) => void;
  } = {},
): Promise<void> {
  const exitProcess = deps.exit ?? process.exit;
  const onSignal =
    deps.on ??
    ((name: string, listener: (...args: unknown[]) => void) => process.on(name, listener));
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
  // The process is already terminating when these run, so only a synchronous kill reaches the children.
  const crash = (error: unknown): void => {
    console.error(error);
    launcher.killNow();
    if (exiting) return;
    exiting = true;
    exitProcess(1);
  };
  const launcher = new Launcher(config, fail);
  onSignal("SIGINT", () => exit(0));
  onSignal("SIGTERM", () => exit(0));
  onSignal("SIGHUP", () => exit(0));
  onSignal("exit", () => launcher.killNow());
  onSignal("uncaughtException", (error: unknown) => crash(error));
  onSignal("unhandledRejection", (reason: unknown) => crash(reason));
  await launcher
    .start(parsed.value)
    .catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
}
