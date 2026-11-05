import type { BotConnection, BotKit, DemoTable } from "@partygame/bots";
import type { BaseGameState } from "@partygame/shared/schema";

/** The TCP ports the launcher's services listen on. */
export interface LaunchPorts {
  game: number;
  api: number;
  clientDev: number;
  production: number;
}

/** The child-process commands the launcher runs, each as an argv array. */
export interface LaunchCommands {
  /** Default: `[execPath, "server.ts"]`, run with env `PORT` and `API_PORT`. */
  server: string[];
  /** Default: `[execPath, "run", "dev", "--strictPort"]`. */
  dev: string[];
  /** Default: `[execPath, "run", "build"]`. */
  build: string[];
}

/** How a game opens a watch-only all-bot room for `--demo`. */
export interface LaunchDemo<TState extends BaseGameState> {
  /** Fewest bots besides the host bot. */
  min: number;
  /** Most bots besides the host bot. */
  max: number;
  /** A watch-only table for `bots` bots besides the host bot. */
  create(options: BotConnection & { bots: number }): DemoTable<TState>;
}

/** How a game seats bots beside a human for `--bots`. */
export interface LaunchBots<TState extends BaseGameState> {
  kit: BotKit<TState>;
  /** Most bots one `--bots` run may seat. */
  max: number;
  /** Count for a bare `--bots`; 3 when omitted. */
  default?: number;
}

/** Everything `runLauncher` needs to start one game's server, API and client. */
export interface LaunchConfig<TState extends BaseGameState> {
  /** Folder with `server.ts`, the `dev` and `build` scripts of its `package.json` and the built `dist/`. */
  gameDir: string;
  /** Used in the usage line and log wording. */
  name: string;
  /** Defaults: 2567, 3001, 5173, 3000. */
  ports?: Partial<LaunchPorts>;
  commands?: Partial<LaunchCommands>;
  /** How long each service may take to answer; 30000 when omitted. */
  readyTimeoutMs?: number;
  bots?: LaunchBots<TState>;
  /** A bare `--demo` seats 3 bots, clamped to `min..max`. */
  demo?: LaunchDemo<TState>;
  /** Default: the platform's opener. */
  openBrowser?: (url: string) => void;
  /** Default: `console.log` with a `[Launch] ` prefix. */
  log?: (line: string) => void;
}
