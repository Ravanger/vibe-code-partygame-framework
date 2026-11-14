import { type ChildProcess, spawn } from "node:child_process";
import { exitReason, killProcessGroup, taskkill } from "./kill.js";

export interface ProcessGroupOptions {
  /** Decides how children are spawned and killed; the running platform when omitted. */
  platform?: NodeJS.Platform;
  runTaskkill?: (pid: number) => void;
  killGroup?: (pid: number) => void;
}

/** The rejection of {@link ProcessGroup.run}. */
export interface CommandError extends Error {
  /** The child's exit code; absent when it was killed by a signal or failed to start. */
  exitCode?: number | undefined;
}

/** Child processes of one launch: services that must stay up, commands that must finish, and one way to stop them all. */
export class ProcessGroup {
  private readonly children = new Set<ChildProcess>();
  private readonly platform: NodeJS.Platform;
  private readonly runTaskkill: (pid: number) => void;
  private readonly killGroup: (pid: number) => void;
  private stopping = false;

  /** `onFailure` hears about a service that dies or cannot start while the group is not stopping. */
  constructor(
    private readonly onFailure: (message: string) => void,
    options: ProcessGroupOptions = {},
  ) {
    this.platform = options.platform ?? process.platform;
    this.runTaskkill = options.runTaskkill ?? taskkill;
    this.killGroup = options.killGroup ?? killProcessGroup;
  }

  /** Spawns a long-running child that is killed on `stop`; an unexpected exit is reported through the failure callback. */
  start(label: string, command: string[], cwd: string, env: Record<string, string> = {}): void {
    const child = this.spawnChild(label, command, cwd, env);
    child.on("error", (error) => this.onFailure(`${label} failed to start: ${error.message}`));
    child.on("exit", (code, signal) => {
      this.children.delete(child);
      if (!this.stopping) {
        this.onFailure(`${label} exited unexpectedly (${exitReason(code, signal)})`);
      }
    });
  }

  /** Runs a command; resolves when it exits with 0, otherwise rejects with a {@link CommandError} carrying the child's exit code. */
  run(label: string, command: string[], cwd: string): Promise<void> {
    return new Promise((done, reject) => {
      const child = this.spawnChild(label, command, cwd, {});
      child.on("error", (error) => {
        const failure: CommandError = new Error(`${label} failed to start: ${error.message}`);
        reject(failure);
      });
      child.on("exit", (code, signal) => {
        this.children.delete(child);
        if (code === 0) return done();
        const failure: CommandError = new Error(`${label} failed (${exitReason(code, signal)})`);
        if (code !== null) failure.exitCode = code;
        reject(failure);
      });
    });
  }

  /** Kills every child process tree and stops reporting exits as failures. */
  stop(): void {
    this.stopping = true;
    for (const child of this.children) this.killTree(child);
    this.children.clear();
  }

  private spawnChild(
    label: string,
    command: string[],
    cwd: string,
    env: Record<string, string>,
  ): ChildProcess {
    const [file, ...args] = command;
    if (!file) throw new Error(`${label} has no command`);
    const child = spawn(file, args, {
      cwd,
      stdio: "inherit",
      env: { ...process.env, ...env },
      detached: this.platform !== "win32",
    });
    this.children.add(child);
    return child;
  }

  private killTree(child: ChildProcess): void {
    if (child.pid === undefined || child.exitCode !== null) return;
    if (this.platform === "win32") {
      this.runTaskkill(child.pid);
      return;
    }
    try {
      this.killGroup(child.pid);
    } catch {
      child.kill("SIGTERM");
    }
  }
}
