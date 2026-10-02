import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waitFor } from "@partygame/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exitReason, killProcessGroup, taskkill } from "../src/kill.js";
import { ProcessGroup, type ProcessGroupOptions } from "../src/ProcessGroup.js";

const PID_AND_IDLE =
  "require('fs').writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000)";
const EXIT_3 = "process.exit(3)";
const MISSING = "definitely-not-a-real-executable";

let dir: string;
let groups: ProcessGroup[];
let pids: number[];
let failures: string[];

const group = (options?: ProcessGroupOptions): ProcessGroup => {
  const made = new ProcessGroup((message) => failures.push(message), options);
  groups.push(made);
  return made;
};

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const startIdle = async (target: ProcessGroup, name: string): Promise<number> => {
  const file = join(dir, name);
  target.start(name, [process.execPath, "-e", PID_AND_IDLE, file], dir);
  const read = (): string => {
    try {
      return readFileSync(file, "utf8");
    } catch {
      return "";
    }
  };
  await waitFor(() => read() !== "", "the pid", 10_000);
  const pid = Number(read());
  pids.push(pid);
  return pid;
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "process-group-"));
  groups = [];
  pids = [];
  failures = [];
});
afterEach(async () => {
  for (const each of groups) each.stop();
  for (const pid of pids) {
    try {
      process.kill(pid);
    } catch {}
  }
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

describe("ProcessGroup", () => {
  it("stops every child it started without reporting a failure", async () => {
    const target = group();
    const first = await startIdle(target, "a");
    const second = await startIdle(target, "b");
    target.stop();
    await waitFor(() => !alive(first) && !alive(second), "the children to die", 10_000);
    await new Promise((done) => setTimeout(done, 200));
    expect(failures).toEqual([]);
  });

  it("kills the tree with taskkill on Windows", async () => {
    const killed: number[] = [];
    const target = group({ platform: "win32", runTaskkill: (pid) => killed.push(pid) });
    const pid = await startIdle(target, "w");
    target.stop();
    expect(killed).toEqual([pid]);
  });

  it("kills the process group elsewhere", async () => {
    const killed: number[] = [];
    const target = group({ platform: "linux", killGroup: (pid) => killed.push(pid) });
    const pid = await startIdle(target, "p");
    target.stop();
    expect(killed).toEqual([pid]);
  });

  it("kills the child itself when the process group cannot be signalled", async () => {
    const target = group({
      platform: "linux",
      killGroup: () => {
        throw new Error("no such group");
      },
    });
    const pid = await startIdle(target, "f");
    target.stop();
    await waitFor(() => !alive(pid), "the child to die", 10_000);
  });

  it("reports a child that exits while the group runs", async () => {
    group().start("worker", [process.execPath, "-e", EXIT_3], dir);
    await waitFor(() => failures.length > 0, "the failure", 10_000);
    expect(failures).toEqual(["worker exited unexpectedly (code 3)"]);
  });

  it("reports an executable that cannot start", async () => {
    group().start("ghost", [MISSING], dir);
    await waitFor(() => failures.length > 0, "the failure", 10_000);
    expect(failures[0]).toMatch(/^ghost failed to start: /);
  });

  it("passes env to a started child", async () => {
    group().start(
      "env",
      [process.execPath, "-e", "process.exit(process.env.WANTED === 'yes' ? 4 : 5)"],
      dir,
      { WANTED: "yes" },
    );
    await waitFor(() => failures.length > 0, "the failure", 10_000);
    expect(failures).toEqual(["env exited unexpectedly (code 4)"]);
  });

  it("refuses an empty command", () => {
    expect(() => group().start("none", [], dir)).toThrow("none has no command");
  });

  it("runs a command to completion", async () => {
    await expect(group().run("ok", [process.execPath, "-e", "0"], dir)).resolves.toBeUndefined();
  });

  it("rejects a command that fails", async () => {
    await expect(group().run("build", [process.execPath, "-e", EXIT_3], dir)).rejects.toThrow(
      "build failed (exit code 3)",
    );
  });

  it("rejects a command that cannot start like a service that cannot start", async () => {
    await expect(group().run("build", [MISSING], dir)).rejects.toThrow(/^build failed to start: /);
  });

  it("refuses an empty command to run", async () => {
    await expect(group().run("none", [], dir)).rejects.toThrow("none has no command");
  });
});

describe("kill helpers", () => {
  it("taskkill ignores a process that does not exist", () => {
    expect(() => taskkill(2 ** 30)).not.toThrow();
  });

  it("killProcessGroup throws for a group that does not exist", () => {
    expect(() => killProcessGroup(2 ** 30)).toThrow();
  });

  it("exitReason names the code or the signal", () => {
    expect(exitReason(3, null)).toBe("code 3");
    expect(exitReason(null, "SIGKILL")).toBe("signal SIGKILL");
  });
});
