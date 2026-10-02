import { spawnSync } from "node:child_process";

export function taskkill(pid: number): void {
  spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
}

/** Sends SIGTERM to the process group led by `pid`; throws when there is none. */
export function killProcessGroup(pid: number): void {
  process.kill(-pid, "SIGTERM");
}

/** How a child ended: `code 3`, or `signal SIGKILL` when it was killed. */
export function exitReason(code: number | null, signal: NodeJS.Signals | null): string {
  return code === null ? `signal ${signal}` : `code ${code}`;
}
