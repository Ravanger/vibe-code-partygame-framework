/**
 * Step runner and cleanup for the template smoke test: runs steps in order, stops at the first
 * failure or a signal-killed child, and always removes the throwaway game and restores bun.lock.
 */
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

/** The outcome of one child process. */
export interface ChildResult {
  /** Exit code; null when the child ended by signal or could not be started. */
  status: number | null;
  /** The signal that ended the child, if any. */
  signal?: string | null;
}

/** Runs a child process and reports its outcome. */
export type RunFn = (command: string, args: readonly string[]) => ChildResult;

/** Default runner: `spawnSync` in `root` with inherited stdio. */
export function spawnRun(root: string): RunFn {
  return (command, args) => {
    const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
    if (result.error) console.error(`[smoke] could not start ${command}: ${result.error.message}`);
    return { status: result.status, signal: result.signal };
  };
}

/** Thrown when a child ended by signal; no further steps may run. */
export class SmokeInterrupted extends Error {
  constructor(readonly signal: string) {
    super(`interrupted by ${signal}`);
  }
}

/** Maps a child outcome to an exit code; throws {@link SmokeInterrupted} when the child ended by signal. */
export function exitCodeOf(child: ChildResult): number {
  if (child.status === null && child.signal) throw new SmokeInterrupted(child.signal);
  return child.status ?? 1;
}

/** One smoke step: a command to run, or a function returning an exit code. */
export type SmokeStep =
  | { name: string; command: string; args: readonly string[] }
  | { name: string; run: () => number | Promise<number> };

export interface SmokeRunOptions {
  /** Working directory for child processes; used by the default runner. */
  root?: string;
  /** Child process runner; defaults to spawnSync in `root`. */
  run?: RunFn;
  /** Step logger; defaults to console.log. */
  log?: (message: string) => void;
}

export interface SmokeResult {
  /** True when every step succeeded. */
  ok: boolean;
  /** The failing step's name, if any. */
  failedStep?: string;
  /** Set when a child ended by signal and no further steps ran. */
  interruptedBy?: string;
}

/** Runs the steps in order; stops at the first failure or a signal-killed child. */
export async function runSmokeSteps(
  options: SmokeRunOptions,
  steps: readonly SmokeStep[],
): Promise<SmokeResult> {
  const run = options.run ?? spawnRun(options.root ?? process.cwd());
  const log = options.log ?? ((message: string) => console.log(message));
  for (const step of steps) {
    try {
      if ("command" in step) {
        log(`[smoke] $ ${step.command} ${step.args.join(" ")}`);
        const code = exitCodeOf(run(step.command, step.args));
        if (code !== 0) {
          log(`[smoke] FAILED: ${step.name} (exit code ${code})`);
          return { ok: false, failedStep: step.name };
        }
      } else {
        const code = await step.run();
        if (code !== 0) {
          log(`[smoke] FAILED: ${step.name} (exit code ${code})`);
          return { ok: false, failedStep: step.name };
        }
      }
    } catch (error) {
      if (error instanceof SmokeInterrupted) {
        log(`[smoke] FAILED: ${step.name} (${error.message})`);
        return { ok: false, interruptedBy: error.signal };
      }
      throw error;
    }
  }
  return { ok: true };
}

export interface CleanupSmokeOptions {
  /** Repo root: where the lockfile lives and child processes run. */
  root: string;
  /** The throwaway game directory to remove. */
  outDir: string;
  /** Lockfile name relative to root (default `bun.lock`). */
  lockfile?: string;
  /** Child process runner; defaults to spawnSync in `root`. */
  run?: RunFn;
  /** Logger for what gets restored; defaults to console.log. */
  log?: (message: string) => void;
}

/**
 * Idempotent smoke cleanup: removes the throwaway game directory, then restores the lockfile via
 * `git checkout -- <lockfile>` when it is tracked, or a re-run of `bun install` (only when the
 * directory existed and modified the lockfile) otherwise.
 */
export function cleanupSmoke({
  root,
  outDir,
  lockfile = "bun.lock",
  run,
  log,
}: CleanupSmokeOptions): void {
  const runner = run ?? spawnRun(root);
  const logger = log ?? ((message: string) => console.log(message));
  const existed = existsSync(outDir);
  rmSync(outDir, { recursive: true, force: true });
  if (runner("git", ["ls-files", "--error-unmatch", lockfile]).status === 0) {
    logger(`[smoke] restoring ${lockfile} (git checkout)`);
    runner("git", ["checkout", "--", lockfile]);
  } else if (existed) {
    logger(`[smoke] restoring ${lockfile} (bun install)`);
    runner("bun", ["install"]);
  }
}

/** Registers SIGINT/SIGTERM handlers that run `cleanup` and exit with the conventional code. */
export function registerSmokeSignals(cleanup: () => void): void {
  for (const [signal, code] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ] as const) {
    process.on(signal, () => {
      cleanup();
      process.exit(code);
    });
  }
}
