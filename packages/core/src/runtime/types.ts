import type { ErrorCode } from "@partygame/shared";
import type { z } from "zod";

/** `"host"` is the room owner; everyone else is a `"player"`. */
export type PlayerRole = "host" | "player";

/** One seat in the room, as the host reports it. Spectators are not seated and never appear here. */
export interface PlayerInfo {
  /** Stable client-generated id. Key every per-player map by this. */
  id: string;
  name: string;
  role: PlayerRole;
  isConnected: boolean;
  /** True once the player has chosen a name. */
  isReady: boolean;
  /** False while waiting to be let in (mid-game joiner). */
  isActive: boolean;
}

/** Fields the runtime writes into the synced state. */
export interface PhaseState {
  phase: string;
  /** Epoch ms at which the current phase times out; 0 when it has no timer. */
  phaseEndsAt: number;
  /** True while in the Lobby with enough active players for `START_GAME`; written by the runtime. */
  canStart: boolean;
}

/** What every hook receives. */
export interface GameContext<TState extends PhaseState, TPrivate, TOptions> {
  /** Synced to every client. */
  readonly state: TState;
  /** Server-only. */
  readonly priv: TPrivate;
  /** Parsed room-create options. */
  readonly options: TOptions;
  readonly phase: string;
  /** Every seat. */
  players(): PlayerInfo[];
  /** Seats that are connected, ready and active. */
  activePlayers(): PlayerInfo[];
  player(id: string): PlayerInfo | undefined;
  /** Make mid-game joiners active. Call at a natural break in the game. */
  activateWaitingPlayers(): void;
  send(playerId: string, type: string, payload: unknown): void;
  broadcast(type: string, payload: unknown): void;
  /** Make a `.view()`-tagged part of the state visible to one player. Re-applied by the server on reconnect. */
  showTo(playerId: string, ref: object): void;
  hideFrom(playerId: string, ref: object): void;
  /** Queued; applied after the current hook returns. The current phase re-enters and restarts its timer. Throws for an undeclared phase. */
  transition(phase: string): void;
  /** Queued; runs `onReturnToLobby` and then enters `Lobby`. */
  returnToLobby(): void;
  /** Random number in [0, 1). */
  rng(): number;
  /** Epoch ms. */
  now(): number;
}

/** Context of an action handler. */
export interface ActionContext<TState extends PhaseState, TPrivate, TOptions, TPayload>
  extends GameContext<TState, TPrivate, TOptions> {
  readonly playerId: string;
  readonly payload: TPayload;
  /** Send an `ERROR` to the actor. Does not stop the handler. */
  reject(code: ErrorCode, message: string): void;
}

/** One client action accepted by a phase. */
export interface ActionDefinition<TState extends PhaseState, TPrivate, TOptions, TPayload> {
  /** `"player"` means any active player, including the host. */
  from: PlayerRole;
  /** Validates the whole action object (`type` plus flat fields). */
  payload: z.ZodType<TPayload>;
  handler(ctx: ActionContext<TState, TPrivate, TOptions, TPayload>): void;
}

/**
 * Method syntax keeps the context parameter bivariant, so definitions for different states stay
 * assignable to an erased `GameDefinition<PhaseState, unknown, unknown>`.
 */
type DurationFn<TState extends PhaseState, TPrivate, TOptions> = {
  compute(ctx: GameContext<TState, TPrivate, TOptions>): number;
}["compute"];

/** One phase of a game. */
export interface PhaseDefinition<TState extends PhaseState, TPrivate, TOptions> {
  /** Milliseconds, or computed on entry. The timer restarts on every entry. */
  duration?: number | DurationFn<TState, TPrivate, TOptions>;
  onEnter?(ctx: GameContext<TState, TPrivate, TOptions>): void;
  /** Required when `duration` is set. */
  onTimeout?(ctx: GameContext<TState, TPrivate, TOptions>): void;
  /** Any join, leave, connect, disconnect or ready change while in this phase. */
  onRosterChange?(ctx: GameContext<TState, TPrivate, TOptions>): void;
  actions?: Record<string, ActionDefinition<TState, TPrivate, TOptions, unknown>>;
}

/** A complete game, as written by a game author. */
export interface GameDefinition<
  TState extends PhaseState,
  TPrivate = Record<string, never>,
  TOptions = Record<string, unknown>,
> {
  name: string;
  minPlayers: number;
  maxPlayers: number;
  /** Phase entered by `START_GAME`. */
  startPhase: string;
  /** Start as soon as everyone is ready and `minPlayers` is met, without the host pressing Start. Default false. */
  autoStart?: boolean;
  /** Parses the room-create options. Omit to pass them through. */
  options?: z.ZodType<TOptions>;
  createPrivateState(): TPrivate;
  /** `"Lobby"` is reserved and built in. */
  phases: Record<string, PhaseDefinition<TState, TPrivate, TOptions>>;
  /** After a player (re)connects: resend their private messages. */
  onPlayerSync?(ctx: GameContext<TState, TPrivate, TOptions>, playerId: string): void;
  onReturnToLobby?(ctx: GameContext<TState, TPrivate, TOptions>): void;
}

/** Everything the runtime needs from its environment. Implemented by the server; faked in tests. */
export interface RuntimeHost {
  players(): PlayerInfo[];
  /** Mark every ready seat active. */
  activateWaitingPlayers(): void;
  /** Mark every unready seat inactive; called when the game leaves the Lobby. */
  benchUnreadyPlayers(): void;
  send(playerId: string, type: string, payload: unknown): void;
  broadcast(type: string, payload: unknown): void;
  showTo(playerId: string, ref: object): void;
  hideFrom(playerId: string, ref: object): void;
  /** Remove the seat and tell the player they were kicked. */
  kick(playerId: string): void;
  /** Make the (validated) room options visible to clients. */
  publishOptions(options: unknown): void;
  now(): number;
  rng(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}
