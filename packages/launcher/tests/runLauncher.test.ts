import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { freePort, ServerProbe } from "@partygame/server/probe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runLauncher } from "../src/runLauncher.js";
import type { LaunchConfig, LaunchPorts } from "../src/types.js";
import type { TapState } from "./fixtures/tapGame.js";

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "game");
const TIMEOUT = 30_000;

let ports: LaunchPorts;
let logs: string[];
let opened: string[];
let spies: Array<{ mockRestore(): void }>;

const devServer = (port: number): string[] => [
  process.execPath,
  "-e",
  `require('http').createServer((q, s) => s.end('dev')).listen(${port})`,
];

const configOf = (
  commands?: Partial<LaunchConfig<TapState>["commands"]>,
  extra?: Partial<LaunchConfig<TapState>>,
): LaunchConfig<TapState> => ({
  gameDir: GAME_DIR,
  name: "Tap",
  ports,
  commands: { server: ["bun", "server.ts"], dev: devServer(ports.clientDev), ...commands },
  openBrowser: (url) => opened.push(url),
  log: (line) => logs.push(line),
  ...extra,
});

const isFree = async (port: number): Promise<boolean> =>
  !(await new ServerProbe().canConnect(port));

const waitUntilFree = async (port: number): Promise<void> => {
  for (let i = 0; i < 50 && !(await isFree(port)); ++i) {
    await new Promise((done) => setTimeout(done, 100));
  }
};

beforeEach(async () => {
  ports = {
    game: await freePort(),
    api: await freePort(),
    clientDev: await freePort(),
    production: await freePort(),
  };
  logs = [];
  opened = [];
  spies = [
    vi.spyOn(console, "error").mockImplementation(() => {}),
    vi.spyOn(console, "log").mockImplementation(() => {}),
  ];
});

afterEach(() => {
  for (const spy of spies) spy.mockRestore();
  // runLauncher registers a handler per invocation; drop them so they do not accumulate in the worker.
  process.removeAllListeners("SIGINT");
  process.removeAllListeners("SIGTERM");
});

describe("runLauncher", () => {
  it("exits with code 2 on bad argv through the injected exit", async () => {
    const exit: number[] = [];
    await runLauncher(configOf(), ["--nope"], { exit: (code) => exit.push(code) });
    expect(exit).toEqual([2]);
  });

  it("exits with code 1 when the launch fails to start", async () => {
    const exit: number[] = [];
    await runLauncher(
      configOf({ server: [process.execPath, "-e", "process.exit(1)"] }),
      ["--no-browser"],
      { exit: (code) => exit.push(code) },
    );
    // The exit happens after `launcher.stop()` settles, not before runLauncher resolves.
    for (let i = 0; i < 50 && exit.length === 0; ++i) {
      await new Promise((done) => setTimeout(done, 100));
    }
    expect(exit).toEqual([1]);
  });

  it("uses process.exit when no exit is injected", async () => {
    const boom = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
    try {
      await expect(runLauncher(configOf(), ["--nope"])).rejects.toThrow("exit:2");
    } finally {
      boom.mockRestore();
    }
  });

  it(
    "stops the launch on SIGINT or SIGTERM and ignores repeated stop requests",
    async () => {
      const exit: number[] = [];
      await runLauncher(configOf(), ["--no-browser"], { exit: (code) => exit.push(code) });
      process.emit("SIGINT");
      process.emit("SIGINT");
      process.emit("SIGTERM");
      for (let i = 0; i < 50 && exit.length === 0; ++i) {
        await new Promise((done) => setTimeout(done, 100));
      }
      expect(exit).toEqual([0]);
      await waitUntilFree(ports.game);
      await waitUntilFree(ports.clientDev);
      expect(await isFree(ports.game)).toBe(true);
      expect(await isFree(ports.clientDev)).toBe(true);
    },
    TIMEOUT,
  );

  it("exits with code 1 when the browser opener fails", async () => {
    const exit: number[] = [];
    await runLauncher(
      configOf(undefined, {
        openBrowser: () => {
          throw "browser boom";
        },
      }),
      [],
      { exit: (code) => exit.push(code) },
    );
    for (let i = 0; i < 50 && exit.length === 0; ++i) {
      await new Promise((done) => setTimeout(done, 100));
    }
    expect(exit).toEqual([1]);
  });
});
