import { existsSync } from "node:fs";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ChildResult,
  cleanupSmoke,
  exitCodeOf,
  registerSmokeSignals,
  runSmokeSteps,
  SmokeInterrupted,
} from "../scripts/smokeRun.js";

const fresh = (prefix: string) => mkdtemp(join(tmpdir(), prefix));
const child = (status: number | null, signal?: string | null): ChildResult =>
  signal === undefined ? { status } : { status, signal };
const quiet = () => ({ root: "/smoke", run: () => child(0), log: () => {} });

describe("exitCodeOf", () => {
  it("returns the exit code", () => {
    expect(exitCodeOf({ status: 3 })).toBe(3);
    expect(exitCodeOf({ status: 0, signal: null })).toBe(0);
  });

  it("returns 1 when the child could not start", () => {
    expect(exitCodeOf({ status: null, signal: null })).toBe(1);
  });

  it("throws SmokeInterrupted naming the signal when the child ended by one", () => {
    const call = () => exitCodeOf({ status: null, signal: "SIGINT" });
    expect(call).toThrowError(SmokeInterrupted);
    expect(call).toThrowError("interrupted by SIGINT");
  });
});

describe("runSmokeSteps", () => {
  it("runs every step in order and reports ok", async () => {
    const lines: string[] = [];
    const run = vi.fn().mockReturnValue(child(0));
    const result = await runSmokeSteps({ root: "/smoke", run, log: (line) => lines.push(line) }, [
      { name: "install", command: "bun", args: ["install"] },
      { name: "render", run: () => 0 },
    ]);
    expect(result).toEqual({ ok: true });
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith("bun", ["install"]);
    expect(lines).toContain("[smoke] $ bun install");
  });

  it("stops after a failing command step and names it", async () => {
    const lines: string[] = [];
    const fn = vi.fn().mockResolvedValue(0);
    const result = await runSmokeSteps(
      { root: "/smoke", run: () => child(2), log: (line) => lines.push(line) },
      [
        { name: "install", command: "bun", args: ["install"] },
        { name: "tests", run: fn },
      ],
    );
    expect(result).toEqual({ ok: false, failedStep: "install" });
    expect(fn).not.toHaveBeenCalled();
    expect(lines).toContain("[smoke] FAILED: install (exit code 2)");
  });

  it("reports a failing function step", async () => {
    const result = await runSmokeSteps(quiet(), [{ name: "render", run: () => 1 }]);
    expect(result).toEqual({ ok: false, failedStep: "render" });
  });

  it("runs no further steps when a child ends by signal", async () => {
    const fn = vi.fn().mockResolvedValue(0);
    const result = await runSmokeSteps(
      { root: "/smoke", run: () => child(null, "SIGINT"), log: () => {} },
      [
        { name: "install", command: "bun", args: ["install"] },
        { name: "tests", run: fn },
      ],
    );
    expect(result).toEqual({ ok: false, interruptedBy: "SIGINT" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("treats a child that could not start as exit code 1", async () => {
    const result = await runSmokeSteps(
      { root: "/smoke", run: () => child(null, null), log: () => {} },
      [{ name: "install", command: "nope", args: [] }],
    );
    expect(result).toEqual({ ok: false, failedStep: "install" });
  });

  it("propagates an error thrown by a step so the caller can clean up", async () => {
    await expect(
      runSmokeSteps(quiet(), [
        {
          name: "render",
          run: () => {
            throw new Error("kaput");
          },
        },
      ]),
    ).rejects.toThrowError("kaput");
  });
});

describe("cleanupSmoke", () => {
  it("removes the out dir and restores a tracked lockfile via git checkout", async () => {
    const root = await fresh("smoke-cleanup-");
    const outDir = join(root, "games", "zz-smoke-test");
    await mkdir(outDir, { recursive: true });
    const run = vi.fn().mockReturnValue(child(0));
    cleanupSmoke({ root, outDir, run, log: () => {} });
    expect(existsSync(outDir)).toBe(false);
    expect(run).toHaveBeenNthCalledWith(1, "git", ["ls-files", "--error-unmatch", "bun.lock"]);
    expect(run).toHaveBeenNthCalledWith(2, "git", ["checkout", "--", "bun.lock"]);
  });

  it("re-runs bun install for an untracked lockfile only when the out dir existed", async () => {
    const root = await fresh("smoke-cleanup-");
    const outDir = join(root, "out");
    await mkdir(outDir, { recursive: true });
    const run = vi.fn().mockReturnValue(child(1)); // probe fails: not tracked
    cleanupSmoke({ root, outDir, run, log: () => {} });
    expect(run).toHaveBeenNthCalledWith(2, "bun", ["install"]);

    const bare = await fresh("smoke-cleanup-");
    const bareRun = vi.fn().mockReturnValue(child(1));
    cleanupSmoke({ root: bare, outDir: join(bare, "out"), run: bareRun, log: () => {} });
    expect(bareRun).toHaveBeenCalledTimes(1); // probe only; no install without an out dir
  });

  it("is idempotent across repeated calls", async () => {
    const root = await fresh("smoke-cleanup-");
    const run = vi.fn().mockReturnValue(child(0));
    cleanupSmoke({ root, outDir: join(root, "out"), run, log: () => {} });
    cleanupSmoke({ root, outDir: join(root, "out"), run, log: () => {} });
    expect(run).toHaveBeenCalledTimes(4); // probe + checkout per call
  });
});

describe("registerSmokeSignals", () => {
  afterEach(() => {
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
  });

  it("cleans up and exits with the conventional code for each signal", () => {
    const cleanup = vi.fn();
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation((code?: string | number | null | undefined): never => {
        throw new Error(`exit:${code}`);
      });
    registerSmokeSignals(cleanup);
    expect(() => process.emit("SIGINT")).toThrowError("exit:130");
    expect(() => process.emit("SIGTERM")).toThrowError("exit:143");
    expect(cleanup).toHaveBeenCalledTimes(2);
    exit.mockRestore();
  });
});
