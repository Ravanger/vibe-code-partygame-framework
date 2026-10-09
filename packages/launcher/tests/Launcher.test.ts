import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@colyseus/sdk";
import { type BotKit, claimName, DemoTable } from "@partygame/bots";
import { freePort, ServerProbe } from "@partygame/server/probe";
import { ClientMessage, resolveRoomCode, waitFor } from "@partygame/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Launcher } from "../src/Launcher.js";
import { type BrowserSpawner, lanUrls } from "../src/network.js";
import type { LaunchConfig, LaunchPorts } from "../src/types.js";
import { TAP_ROOM, TapState } from "./fixtures/tapGame.js";

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "game");
const IDLE = "setInterval(() => {}, 1000)";
const TIMEOUT = 30_000;

const kit: BotKit<TapState> = {
  roomName: TAP_ROOM,
  stateClass: TapState,
  strategy: { play: (turn) => turn.once("tap", () => turn.act("TAP")) },
};

let ports: LaunchPorts;
let logs: string[];
let opened: string[];
let failures: string[];
let launchers: Launcher<TapState>[];
let blockers: Server[];
let leavers: Array<() => Promise<unknown>>;

const devServer = (port: number): string[] => [
  process.execPath,
  "-e",
  `require('http').createServer((q, s) => s.end('dev')).listen(${port})`,
];

const configOf = (extra: Partial<LaunchConfig<TapState>> = {}): LaunchConfig<TapState> => ({
  gameDir: GAME_DIR,
  name: "Tap",
  ports,
  commands: { server: ["bun", "server.ts"], dev: devServer(ports.clientDev) },
  openBrowser: (url) => opened.push(url),
  log: (line) => logs.push(line),
  ...extra,
});

const launcherOf = (extra: Partial<LaunchConfig<TapState>> = {}): Launcher<TapState> => {
  const made = new Launcher(configOf(extra), (message) => failures.push(message));
  launchers.push(made);
  return made;
};

const quick = { thinkMs: [0, 5], reactMs: [0, 5] } as const;

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
  failures = [];
  launchers = [];
  blockers = [];
  leavers = [];
});
afterEach(async () => {
  await Promise.allSettled(leavers.map((leave) => leave()));
  for (const each of launchers) await each.stop();
  for (const each of blockers) await new Promise((done) => each.close(done));
});

describe("Launcher", () => {
  it(
    "starts the server and the client dev server, logs Ready and opens the browser",
    async () => {
      await launcherOf().start({ mode: "dev", openBrowser: true });
      const url = `http://localhost:${ports.clientDev}`;
      expect(logs).toContain(`Ready (dev): ${url}`);
      expect(logs).toContain("Game server is ready");
      expect(logs).toContain("Vite is ready");
      expect(logs.some((line) => line.startsWith("Guests on this network"))).toBe(false);
      expect(opened).toEqual([url]);
      expect(await new ServerProbe().isGameServer(ports.game, ports.api)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "stops every process on stop",
    async () => {
      const launcher = launcherOf();
      await launcher.start({ mode: "dev", openBrowser: false });
      await launcher.stop();
      await waitUntilFree(ports.game);
      await waitUntilFree(ports.clientDev);
      expect(await isFree(ports.game)).toBe(true);
      expect(await isFree(ports.clientDev)).toBe(true);
      expect(failures).toEqual([]);
    },
    TIMEOUT,
  );

  it(
    "lists the LAN addresses in host mode and asks the user to open the page without a browser",
    async () => {
      await launcherOf().start({ mode: "host", openBrowser: false });
      const lan = lanUrls(ports.clientDev).map((url) => `Guests on this network: ${url}`);
      expect(logs.filter((line) => line.startsWith("Guests on this network"))).toEqual(lan);
      expect(logs).toContain(`Open http://localhost:${ports.clientDev}`);
      expect(opened).toEqual([]);
    },
    TIMEOUT,
  );

  it(
    "builds and serves the built client in prod",
    async () => {
      const dir = await mkdtemp(join(tmpdir(), "launcher-build-"));
      await mkdir(join(dir, "dist"));
      await writeFile(join(dir, "dist", "index.html"), "<h1>built client</h1>");
      const marker = join(dir, "built");
      let launcher: Launcher<TapState> | undefined;
      try {
        launcher = launcherOf({
          gameDir: dir,
          commands: {
            server: ["bun", join(GAME_DIR, "server.ts")],
            build: [
              process.execPath,
              "-e",
              `require('fs').writeFileSync(${JSON.stringify(marker)}, 'x')`,
            ],
          },
        });
        await launcher.start({ mode: "prod", openBrowser: true });
        expect(existsSync(marker)).toBe(true);
        const url = `http://localhost:${ports.production}`;
        expect(opened).toEqual([url]);
        expect(await (await fetch(`${url}/`)).text()).toContain("built client");
        expect(logs.some((line) => line.startsWith("Serving "))).toBe(true);
        expect(logs).toContain(`Ready (prod): ${url}`);
      } finally {
        await launcher?.stop();
        await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      }
    },
    TIMEOUT,
  );

  it(
    "fails when the build fails",
    async () => {
      const launcher = launcherOf({
        commands: {
          server: ["bun", "server.ts"],
          build: [process.execPath, "-e", "process.exit(3)"],
        },
      });
      await expect(launcher.start({ mode: "prod", openBrowser: true })).rejects.toThrow(
        "Building client failed (exit code 3)",
      );
      expect(await isFree(ports.game)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "refuses a taken port before starting anything",
    async () => {
      const blocker = createServer();
      blockers.push(blocker);
      await new Promise<void>((done) => blocker.listen(ports.api, done));
      await expect(launcherOf().start({ mode: "dev", openBrowser: true })).rejects.toThrow(
        `Port ${ports.api} (API) is already in use`,
      );
      expect(await isFree(ports.game)).toBe(true);
      expect(opened).toEqual([]);
    },
    TIMEOUT,
  );

  it(
    "fails when the server command exits",
    async () => {
      const launcher = launcherOf({
        commands: { server: [process.execPath, "-e", "process.exit(1)"] },
      });
      await expect(launcher.start({ mode: "dev", openBrowser: true })).rejects.toThrow(
        "game server exited unexpectedly (code 1)",
      );
      expect(failures).toEqual([]);
    },
    TIMEOUT,
  );

  it(
    "fails when a service never answers",
    async () => {
      const launcher = launcherOf({
        commands: { server: [process.execPath, "-e", IDLE] },
        readyTimeoutMs: 400,
      });
      await expect(launcher.start({ mode: "dev", openBrowser: true })).rejects.toThrow(
        "Game server did not answer within 0.4s",
      );
    },
    TIMEOUT,
  );

  it(
    "logs through console with a prefix by default",
    async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        const { log: _log, openBrowser: _open, ...rest } = configOf();
        const launcher = new Launcher(rest, (message) => failures.push(message));
        launchers.push(launcher);
        await launcher.start({ mode: "dev", openBrowser: false });
        expect(spy).toHaveBeenCalledWith(
          `[Launch] Ready (dev): http://localhost:${ports.clientDev}`,
        );
      } finally {
        spy.mockRestore();
      }
    },
    TIMEOUT,
  );

  it(
    "seats bots in a room opened for the human",
    async () => {
      const launcher = launcherOf({ bots: { kit, max: 3 } });
      await launcher.start({ mode: "dev", openBrowser: true, bots: 1 });
      await waitFor(() => opened.length === 1, "the join link", 10_000);
      const link = new URL(opened[0] ?? "");
      expect(link.origin).toBe(`http://localhost:${ports.clientDev}`);
      const code = link.searchParams.get("code") ?? "";
      expect(code).not.toBe("");
      expect(logs).toContain(`Room ${code}: bots join once you have entered your name`);

      const roomId = await resolveRoomCode(`http://localhost:${ports.api}`, code);
      const playerId = crypto.randomUUID();
      const room = await new Client(`ws://localhost:${ports.game}`).joinById<TapState>(
        roomId,
        { playerId },
        TapState,
      );
      leavers.push(() => room.leave(true));
      await claimName(room, playerId, "Ann");
      await waitFor(() => logs.includes(`Bot 1 joined ${code}`), "the bot to join", 10_000);
      expect(room.state.players.size).toBe(2);

      await room.request(ClientMessage.ACTION, { type: "START_GAME" });
      await waitFor(
        () => logs.some((line) => line.startsWith("Bots: Bot 1 TAP")),
        "the bot to act",
        10_000,
      );

      await launcher.stop();
    },
    TIMEOUT,
  );

  it(
    "opens the TV view of a demo room and reports when the game is over",
    async () => {
      const launcher = launcherOf({
        demo: {
          min: 1,
          max: 3,
          create: (options) =>
            new DemoTable<TapState>({
              ...kit,
              ...options,
              bot: { ...options.bot, ...quick },
              isFinished: (state) => state.done,
            }),
        },
      });
      await launcher.start({ mode: "dev", openBrowser: true, demo: 1 });
      await waitFor(() => logs.includes("Demo finished; Ctrl+C to exit"), "the demo", 20_000);
      const code = new URL(opened[0] ?? "").searchParams.get("tv") ?? "";
      expect(code).not.toBe("");
      expect(logs).toContain(`Demo room ${code}: watch-only, 2 bots play one game`);
    },
    TIMEOUT,
  );

  it(
    "leaves the table before it stops the processes",
    async () => {
      const events: string[] = [];
      class Recording extends DemoTable<TapState> {
        override async leave(): Promise<void> {
          events.push(
            `leave (server up: ${await new ServerProbe().isGameServer(ports.game, ports.api)})`,
          );
          await super.leave();
        }
      }
      const launcher = launcherOf({
        demo: {
          min: 1,
          max: 3,
          create: (options) =>
            new Recording({
              ...kit,
              ...options,
              bot: { ...options.bot, ...quick },
              isFinished: (state) => state.done,
            }),
        },
      });
      await launcher.start({ mode: "dev", openBrowser: false, demo: 1 });
      await waitFor(() => logs.includes("Demo finished; Ctrl+C to exit"), "the demo", 20_000);
      await launcher.stop();
      expect(events).toEqual(["leave (server up: true)"]);
      await waitUntilFree(ports.game);
      expect(await isFree(ports.game)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "does not wait more than a second for a table that will not leave",
    async () => {
      class Stuck extends DemoTable<TapState> {
        override leave(): Promise<void> {
          return new Promise(() => {});
        }
      }
      const launcher = launcherOf({
        demo: {
          min: 1,
          max: 3,
          create: (options) => new Stuck({ ...kit, ...options, isFinished: (state) => state.done }),
        },
      });
      await launcher.start({ mode: "dev", openBrowser: false, demo: 1 });
      await waitFor(() => logs.some((line) => line.startsWith("Demo room")), "the room", 10_000);
      const began = Date.now();
      await launcher.stop();
      expect(Date.now() - began).toBeLessThan(5000);
    },
    TIMEOUT,
  );

  it(
    "logs when the bots cannot start",
    async () => {
      const broken: BotKit<TapState> = { ...kit, roomName: "no-such-room" };
      await launcherOf({ bots: { kit: broken, max: 3 } }).start({
        mode: "dev",
        openBrowser: false,
        bots: 1,
      });
      await waitFor(
        () => logs.some((line) => line.startsWith("Bots stopped: ")),
        "the log",
        10_000,
      );
    },
    TIMEOUT,
  );

  it(
    "logs when the demo cannot start",
    async () => {
      await launcherOf({
        demo: {
          min: 1,
          max: 3,
          create: () => {
            throw "boom";
          },
        },
      }).start({ mode: "dev", openBrowser: false, demo: 1 });
      await waitFor(() => logs.includes("Demo stopped: boom"), "the log", 10_000);
    },
    TIMEOUT,
  );

  it(
    "refuses bots before starting anything when the config has none",
    async () => {
      await expect(
        launcherOf().start({ mode: "dev", openBrowser: false, bots: 1 }),
      ).rejects.toThrow("Tap has no bots");
      expect(await isFree(ports.game)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "refuses a demo before starting anything when the config has none",
    async () => {
      await expect(
        launcherOf().start({ mode: "dev", openBrowser: false, demo: 1 }),
      ).rejects.toThrow("Tap has no demo");
      expect(await isFree(ports.game)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "reports a service that dies after the launch through onFailure",
    async () => {
      const dying = [
        process.execPath,
        "-e",
        `require('http').createServer((q, s) => s.end('dev')).listen(${ports.clientDev}); setTimeout(() => process.exit(2), 3000)`,
      ];
      await launcherOf({
        commands: { server: ["bun", "server.ts"], dev: dying },
      }).start({ mode: "dev", openBrowser: false });
      expect(failures).toEqual([]);
      await waitFor(() => failures.length > 0, "the failure", 10_000);
      expect(failures).toEqual(["Vite dev server exited unexpectedly (code 2)"]);
    },
    TIMEOUT,
  );

  it(
    "tells the user to open the page when the browser cannot start",
    async () => {
      const { openBrowser: _open, ...rest } = configOf();
      const spawnFn: BrowserSpawner = () => ({
        on: (_event, listener) => listener(),
        unref: () => undefined,
      });
      const launcher = new Launcher(rest, (message) => failures.push(message), spawnFn);
      launchers.push(launcher);
      await launcher.start({ mode: "dev", openBrowser: true });
      expect(logs).toContain(
        `Could not open a browser. Open http://localhost:${ports.clientDev} yourself.`,
      );
    },
    TIMEOUT,
  );

  it(
    "cancels its timeout when the table leaves in time",
    async () => {
      const launcher = launcherOf({
        demo: {
          min: 1,
          max: 3,
          create: (options) =>
            new DemoTable<TapState>({
              ...kit,
              ...options,
              bot: { ...options.bot, ...quick },
              isFinished: (state) => state.done,
            }),
        },
      });
      await launcher.start({ mode: "dev", openBrowser: false, demo: 1 });
      await waitFor(() => logs.some((line) => line.startsWith("Demo room")), "the room", 10_000);
      const started = vi.spyOn(globalThis, "setTimeout");
      const cleared = vi.spyOn(globalThis, "clearTimeout");
      try {
        await launcher.stop();
        const index = started.mock.calls.findIndex(([, delay]) => delay === 1000);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(cleared).toHaveBeenCalledWith(started.mock.results[index]?.value);
      } finally {
        started.mockRestore();
        cleared.mockRestore();
      }
    },
    TIMEOUT,
  );
});
