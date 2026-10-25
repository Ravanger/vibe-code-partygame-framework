import type { BotKit, BotOptions } from "@partygame/bots";
import type { TextFilter } from "@partygame/content/filter";
import type { GameDefinition } from "@partygame/core";
import type { LaunchConfig } from "@partygame/launcher";
import type { HostedGame } from "@partygame/server";
import type { BaseGameState } from "@partygame/shared/schema";
import type { Prompter, TerminalStrategy } from "@partygame/terminal";

/** The browser-safe identity and limits of a game (a game keeps it in its own `src/meta.ts`). */
export interface GameMeta {
  roomName: string;
  minPlayers: number;
  maxPlayers: number;
}

/** Demo extras beyond the kit: which table to build and how to pace it. */
export interface GameDemoOptions<TState extends BaseGameState> {
  /** The kit variant for the demo tables; `botKit` when omitted. */
  kit?: BotKit<TState>;
  /** Create options for the demo room. */
  roomOptions?: object;
  /** Pacing and logging for every demo bot, merged under any per-connection bot options. */
  bot?: BotOptions;
  /** Name of the host bot. */
  hostName?: string;
  /** Lines to print on each spectator state change (a commentator). */
  narrate?(state: TState): readonly string[];
  /** Game-specific problems in the final spectator state, e.g. scores that do not add up. */
  problems?(state: TState): readonly string[];
  /** The line printed when the demo passes; "PASS: no action was rejected" by default. */
  passMessage?: string;
}

/** One game declared once: what to host, how to launch it and who plays it. */
export interface GameDeclaration<TState extends BaseGameState, TContent = undefined> {
  meta: GameMeta;
  /** Display name for the launcher; `meta.roomName` when omitted. */
  displayName?: string;
  /** Loads server-side content; without it `definition` is called with `undefined`. */
  load?(env: NodeJS.ProcessEnv): Promise<TContent>;
  definition(content: TContent): GameDefinition<BaseGameState, unknown, unknown>;
  /** The room's text filter (player names and the game's filtered actions); `serve` hands it to the server starter. */
  textFilter?: TextFilter;
  stateClass: new () => TState;
  /**
   * The state's public fields, handed to the server as `HostedGame.publicFields`. Every field of
   * `stateClass` that is neither listed here nor tagged `.view()` (fields of `BaseGameState`
   * excepted) fails the server at startup.
   */
  publicFields?: readonly string[];
  /** True once the game is over; the demo tables watch for it. */
  isFinished(state: TState): boolean;
  botKit: BotKit<TState>;
  /** The terminal screens `play` drives. */
  terminal?: () => TerminalStrategy<TState>;
  /** Demo extras beyond the kit. */
  demo?: GameDemoOptions<TState>;
}

/** What `serve` hands to a server starter, before the starter picks ports of its own. */
export interface ServeOptions {
  games: HostedGame[];
  port?: number;
  apiPort?: number;
  /** The declaration's text filter, so the room checks player names and filtered actions. */
  textFilter?: TextFilter;
}

/** The injectable process behind a one-line entry stub. */
export interface GameKitIo {
  env: NodeJS.ProcessEnv;
  argv: string[];
  exit: (code: number) => void;
  log: (line: string) => void;
  error: (line: string) => void;
  /** Registers a process signal handler. */
  onSignal: (signal: "SIGINT", handler: () => void) => void;
  /** Builds the prompter `play` asks questions through; `stop` ends the session when the input closes or is interrupted. */
  prompter: (stop: () => void) => Prompter;
  /** The server starter for `serve`. */
  startServer: (options: ServeOptions) => Promise<unknown>;
  /** The launcher for `launch`. */
  runLauncher: <TState extends BaseGameState>(
    config: LaunchConfig<TState>,
    argv: string[],
  ) => Promise<void>;
}
