import { spawn } from "node:child_process";
import { join } from "node:path";
import { type BotConnection, BotTable, type DemoTable } from "@partygame/bots";
import { ServerProbe } from "@partygame/server/node";
import { joinUrl, tvUrl } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";
import type { LaunchArgs } from "./LaunchArgs.js";
import { type BrowserSpawner, lanUrls, openBrowser } from "./network.js";
import { ProcessGroup } from "./ProcessGroup.js";
import { StaticSite } from "./StaticSite.js";
import type { LaunchBots, LaunchCommands, LaunchConfig, LaunchDemo, LaunchPorts } from "./types.js";

const DEFAULT_READY_TIMEOUT_MS = 30_000;
const POLL_MS = 200;
const LEAVE_TIMEOUT_MS = 1000;

/** Runs a game's server, API and client, and optionally a bot table, from one config. */
export class Launcher<TState extends BaseGameState> {
  private readonly ports: LaunchPorts;
  private readonly commands: LaunchCommands;
  private readonly readyTimeoutMs: number;
  private readonly open: (url: string) => void;
  private readonly log: (line: string) => void;
  private readonly processes: ProcessGroup;
  private readonly site = new StaticSite();
  private readonly probe = new ServerProbe();
  private table: { leave(): Promise<void> } | undefined;
  private failure: string | undefined;
  private started = false;

  /** `onFailure` hears about a service that dies once `start` has resolved; a failure while starting rejects `start` instead. `spawnFn` opens the browser when the config has no opener. */
  constructor(
    private readonly config: LaunchConfig<TState>,
    onFailure: (message: string) => void,
    spawnFn: BrowserSpawner = spawn,
  ) {
    this.ports = { game: 2567, api: 3001, clientDev: 5173, production: 3000, ...config.ports };
    this.commands = {
      server: [process.execPath, "server.ts"],
      dev: [process.execPath, "run", "dev", "--strictPort"],
      build: [process.execPath, "run", "build"],
      ...config.commands,
    };
    this.readyTimeoutMs = config.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
    this.log = config.log ?? ((line) => console.log(`[Launch] ${line}`));
    this.open =
      config.openBrowser ??
      ((url) =>
        openBrowser(url, {
          spawnFn,
          onError: () => this.log(`Could not open a browser. Open ${url} yourself.`),
        }));
    this.processes = new ProcessGroup((message) => {
      this.failure = message;
      if (this.started) onFailure(message);
    });
  }

  /** Resolves once the game is being served; bots and the demo carry on in the background. */
  async start(args: LaunchArgs): Promise<void> {
    const { mode } = args;
    const botsRun =
      args.bots === undefined
        ? undefined
        : { bots: this.require(this.config.bots, "bots"), count: args.bots };
    const demoRun =
      args.demo === undefined
        ? undefined
        : { demo: this.require(this.config.demo, "demo"), count: args.demo };
    const clientPort = mode === "prod" ? this.ports.production : this.ports.clientDev;
    await this.assertPortsFree({
      "game server": this.ports.game,
      API: this.ports.api,
      client: clientPort,
    });
    if (mode === "prod") {
      this.log("Building client...");
      await this.processes.run("Building client", this.commands.build, this.config.gameDir);
    }
    await this.startGameServer();
    if (mode === "prod") await this.serveProduction(clientPort);
    else await this.startClientDev();

    const url = `http://localhost:${clientPort}`;
    this.log(`Ready (${mode}): ${url}`);
    if (mode !== "dev") {
      for (const lan of lanUrls(clientPort)) this.log(`Guests on this network: ${lan}`);
    }
    this.log("Press Ctrl+C to stop");
    this.started = true;
    if (demoRun) {
      this.startDemo(demoRun.demo, demoRun.count, url, args.openBrowser).catch((error: unknown) =>
        this.log(`Demo stopped: ${this.messageOf(error)}`),
      );
    } else if (botsRun) {
      this.startBots(botsRun.bots, botsRun.count, url, args.openBrowser).catch((error: unknown) =>
        this.log(`Bots stopped: ${this.messageOf(error)}`),
      );
    } else {
      this.show(url, args.openBrowser);
    }
  }

  /** Leaves the bot or demo table (waiting at most a second), then stops every process and the static site. */
  async stop(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const patience = new Promise<void>((done) => {
      timer = setTimeout(done, LEAVE_TIMEOUT_MS);
    });
    try {
      await Promise.race([Promise.allSettled([this.table?.leave()]), patience]);
    } finally {
      clearTimeout(timer);
    }
    this.processes.stop();
    await this.site.close();
  }

  private show(url: string, openBrowser: boolean): void {
    if (openBrowser) {
      this.log(`Opening ${url}`);
      this.open(url);
    } else {
      this.log(`Open ${url}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((done) => setTimeout(done, ms));
  }

  private require<T>(value: T | undefined, what: string): T {
    if (value === undefined) throw new Error(`${this.config.name} has no ${what}`);
    return value;
  }

  private messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async assertPortsFree(ports: Record<string, number>): Promise<void> {
    for (const [label, port] of Object.entries(ports)) {
      if (await this.probe.canConnect(port)) {
        throw new Error(`Port ${port} (${label}) is already in use`);
      }
    }
  }

  private async waitUntilReady(label: string, isReady: () => Promise<boolean>): Promise<void> {
    const deadline = Date.now() + this.readyTimeoutMs;
    while (!(await isReady())) {
      if (this.failure) throw new Error(this.failure);
      if (Date.now() > deadline) {
        throw new Error(`${label} did not answer within ${this.readyTimeoutMs / 1000}s`);
      }
      await this.sleep(POLL_MS);
    }
    this.log(`${label} is ready`);
  }

  private async startGameServer(): Promise<void> {
    this.log("Starting game server...");
    this.processes.start("game server", this.commands.server, this.config.gameDir, {
      PORT: String(this.ports.game),
      API_PORT: String(this.ports.api),
    });
    await this.waitUntilReady("Game server", () =>
      this.probe.isGameServer(this.ports.game, this.ports.api),
    );
  }

  private async startClientDev(): Promise<void> {
    this.log("Starting Vite dev server...");
    this.processes.start("Vite dev server", this.commands.dev, this.config.gameDir);
    await this.waitUntilReady("Vite", () =>
      this.probe.answers(`http://localhost:${this.ports.clientDev}/`),
    );
  }

  private async serveProduction(port: number): Promise<void> {
    const dist = join(this.config.gameDir, "dist");
    await this.site.serve(dist, port);
    this.log(`Serving ${dist} on port ${port}`);
  }

  private connection(): BotConnection & { bot: { log: (line: string) => void } } {
    return {
      endpoint: `ws://localhost:${this.ports.game}`,
      apiPort: this.ports.api,
      bot: { log: (line: string) => this.log(`Bots: ${line}`) },
    };
  }

  private async startBots(
    bots: LaunchBots<TState>,
    count: number,
    clientUrl: string,
    browser: boolean,
  ): Promise<void> {
    const table = new BotTable({ ...bots.kit, ...this.connection() });
    this.table = table;
    const code = await table.open();
    this.log(`Room ${code}: bots join once you have entered your name`);
    this.show(joinUrl(`${clientUrl}/`, code), browser);
    for (const bot of await table.seatBots({ count })) this.log(`${bot.name} joined ${code}`);
  }

  private async startDemo(
    demo: LaunchDemo<TState>,
    count: number,
    clientUrl: string,
    browser: boolean,
  ): Promise<void> {
    const table: DemoTable<TState> = demo.create({ ...this.connection(), bots: count });
    this.table = table;
    const code = await table.open();
    this.log(`Demo room ${code}: watch-only, ${count + 1} bots play one game`);
    this.show(tvUrl(`${clientUrl}/`, code), browser);
    await table.seatBots();
    await table.finished();
    this.log("Demo finished; Ctrl+C to exit");
  }
}
