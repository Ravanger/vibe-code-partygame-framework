import type { BaseGameState } from "@partygame/shared/schema";

/** The part of a connected room a bot needs. `Room` from `@colyseus/sdk` satisfies it. */
export interface BotRoom<TState extends BaseGameState> {
  readonly state: TState;
  onStateChange(callback: () => void): unknown;
  onLeave(callback: () => void): unknown;
  request(type: string, payload: object): Promise<unknown>;
  leave(consented: boolean): Promise<unknown>;
}

/** What came back for one action a bot sent. `ok` is false for a rejection and for a failed request. */
export interface BotOutcome {
  bot: string;
  type: string;
  ok: boolean;
  detail: string;
}

export type DelayRange = readonly [minMs: number, maxMs: number];

/** `think` paces slow moves (writing, choosing), `react` quick ones (voting, confirming). */
export type BotSpeed = "think" | "react";

/** Handed to a strategy on every state change. Keys passed to `once` are forgotten when the phase changes. */
export interface BotTurn<TState extends BaseGameState> {
  readonly state: TState;
  readonly playerId: string;
  readonly name: string;
  /** Runs `run` the first time `key` is seen in the current phase. */
  once(key: string, run: () => void): void;
  /** Runs `run` after a random delay; cancelled when the phase changes or the bot leaves. */
  later(delay: BotSpeed | DelayRange, run: () => void): void;
  /** Sends action `type`; the outcome goes to `onOutcome` and `log`. `note` describes it in the log. `type` overrides any `type` in `payload`. */
  act(type: string, payload?: object, note?: string): void;
  /** A random element, or `undefined` for an empty list. */
  pick<T>(items: readonly T[]): T | undefined;
}

/** A game's bot brain. `play` runs for every bot, `host` only for the hosting bot, after the built-in start. */
export interface BotStrategy<TState extends BaseGameState> {
  play(turn: BotTurn<TState>): void;
  host?(turn: BotTurn<TState>): void;
}

export interface BotHostOptions {
  /** Named seats to wait for before starting; the room's own `canStart` rule always applies too. */
  expectedPlayers?: number;
}

export interface BotOptions {
  rng?: () => number;
  /** Runs `run` after `ms` and returns a canceller. */
  schedule?: (run: () => void, ms: number) => () => void;
  thinkMs?: DelayRange;
  reactMs?: DelayRange;
  log?: (line: string) => void;
  onOutcome?: (outcome: BotOutcome) => void;
  /** Makes this bot the host: it starts the game and runs `strategy.host`. */
  host?: BotHostOptions;
}

/** Everything the tables need to know about a game. */
export interface BotKit<TState extends BaseGameState> {
  roomName: string;
  stateClass: new () => TState;
  strategy: BotStrategy<TState>;
}

/** Where a game server and its API live, plus how its bots behave. */
export interface BotConnection {
  endpoint: string;
  apiPort: number;
  bot?: BotOptions;
}
