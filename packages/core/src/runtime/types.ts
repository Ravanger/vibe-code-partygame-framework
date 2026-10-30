import type { FilterLevel } from "@partygame/content/filter";
import type { ErrorCode } from "@partygame/shared";
import type { z } from "zod";
import type { Seed } from "../utils.js";
import type { CoreStrings } from "./strings.js";

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

/** What a game's `canJoin` hook receives about one join attempt. */
export interface CanJoinInput {
  /** The stable client-generated id of the joining seat. */
  playerId: string;
  /** The name the client proposes, if any. */
  name?: string;
  /** True when the client joins without a seat (for example a TV display). */
  spectator: boolean;
  /** String/number/boolean data the client sent with the join. */
  joinData: Readonly<Record<string, string | number | boolean>>;
  /** The seats as reported before this join is admitted. */
  roster: PlayerInfo[];
}

/** The outcome of a `canJoin` check: an accept or a refusal with a game-authored message. */
export type CanJoinResult = { ok: true } | { ok: false; code: string; message: string };

/** Fields the runtime writes into the synced state. */
export interface PhaseState {
  phase: string;
  /** Epoch ms at which the current phase times out; 0 when it has no timer. */
  phaseEndsAt: number;
  /** True while in the Lobby with enough active players for `START_GAME`; written by the runtime. */
  canStart: boolean;
  /** Set to a fixed message by the runtime's default failure policy when a hook throws (see `GameDefinition.onError`); the runtime clears it when `START_GAME` begins the next game. */
  notice?: string;
}

/** The level of a log line. */
export type LogLevel = "info" | "warn" | "error";

/**
 * The field map of a log line: strings, numbers or booleans only — never player names, payloads
 * or free text (see the framework guide's Logging section).
 */
export type LogFields = Record<string, string | number | boolean>;

/**
 * A structured log sink. Each call carries an event name and optional {@link LogFields}. Hosts
 * bind the room id and timestamp before writing.
 */
export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

/** One logged line as captured by `FakeHost.logs`. */
export interface LogLine {
  level: LogLevel;
  event: string;
  fields?: LogFields;
}

/**
 * The logger game code gets as `ctx.log`: call it for an `info` line, or use `.warn`/`.error`.
 */
export interface ContextLogger {
  (event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

/** A no-op logger, usable as a host sink (`RuntimeHost.log`) or a context logger (`GameContext.log`): drops every line. */
export const noopLogger: Logger & ContextLogger = Object.assign(() => {}, {
  info: () => {},
  warn: () => {},
  error: () => {},
});

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
  /**
   * A UUID-shaped identifier drawn from the room RNG. Use it for any id that lands in synced state
   * or an action payload — `crypto.randomUUID()` breaks replay, because re-dispatched payloads
   * reference ids a fresh runtime never generated.
   */
  newId(): string;
  /** Epoch ms. */
  now(): number;
  /** Logs a structured line for this room, e.g. `ctx.log("custom.event", { n: 1 })` (info) or `ctx.log.warn(...)`. Field values are strings, numbers or booleans; never names or payloads. */
  log: ContextLogger;
  /** The definition's name; recorded in the action log header for replay sanity checks. */
  readonly gameName: string;
  /** The definition's version; recorded in the action log header for replay sanity checks. */
  readonly gameVersion: string;
  /** The room RNG seed; see `sfc32`. Recorded in the action log header. */
  readonly seed: Seed;
}

/** Context of an action handler. */
export interface ActionContext<TState extends PhaseState, TPrivate, TOptions, TPayload>
  extends GameContext<TState, TPrivate, TOptions> {
  readonly playerId: string;
  readonly payload: TPayload;
  /** Send an `ERROR` to the actor. Does not stop the handler. */
  reject(code: ErrorCode, message: string): void;
}

/** The once-per-scope check audience handlers use for votes and reactions. */
export interface AudienceScope {
  /** True the first time this sender uses `scope`; false afterwards until the host clears the scopes (on a phase change). */
  once(scope: string): boolean;
}

/** Context of an audience action handler: the sender is seatless, so there is no `playerId`. */
export interface AudienceActionContext<TState extends PhaseState, TPrivate, TOptions, TPayload>
  extends Omit<ActionContext<TState, TPrivate, TOptions, TPayload>, "playerId"> {
  readonly audience: AudienceScope;
}

/** What a middleware observes or wraps. */
export type MiddlewareEvent =
  | { kind: "enter" }
  | { kind: "timeout" }
  | { kind: "roster-change" }
  | {
      kind: "action";
      actionType: string;
      senderId: string;
      payload: unknown;
      /** The action definition's declared text fields, when it has any. */
      textFields?: readonly string[];
      /** The room's current text-filter level (`GameDefinition.filterLevel`, default `"off"`). */
      filterLevel: FilterLevel;
    }
  | { kind: "transition"; from: string; to: string };

/** Options for {@link MiddlewareContext.reject}. */
export interface RejectOptions {
  /**
   * Ask the action log to record this rejection without its payload: the entry gets
   * `rejected: true` and `redacted: true` and no `payload`, so the rejected text (e.g. a filter
   * hit) never lands in the log or a replay bundle. `replayLog` skips such entries — they were
   * refused before the handler ran and changed no state.
   */
  redactPayload?: boolean;
}

/** What a middleware receives: the game context plus the event being wrapped or observed. */
export interface MiddlewareContext<TState extends PhaseState, TPrivate, TOptions>
  extends GameContext<TState, TPrivate, TOptions> {
  readonly event: MiddlewareEvent;
  /**
   * `ctx.reject()` calls (middleware or handler) and a handler-thrown `FrameworkError` recorded
   * since this dispatch started. Live: read it after `next()` to see whether the action was
   * rejected. Pre-chain rejections never enter the chain, so a non-zero count here means the
   * rejection happened inside this chain.
   */
  readonly rejectionCount: number;
  /**
   * Rejections recorded since this dispatch started that asked for payload redaction (a `reject`
   * with `redactPayload: true`). Always ≤ {@link rejectionCount}; read it after `next()`, like
   * the count.
   */
  readonly redactedRejectionCount: number;
  /**
   * Send an `ERROR` to the action's sender with `code` and `message`; counted in
   * {@link rejectionCount}, and in {@link redactedRejectionCount} when `redactPayload` is set.
   * Available for `action` events only — throws for any other event kind. Does not stop the chain
   * by itself: omit `next()` to skip what is inside.
   */
  reject(code: ErrorCode, message: string, options?: RejectOptions): void;
}

/**
 * A Koa-style onion layer around phase hooks and action handlers; first registered runs
 * outermost. Synchronous in v1 — the `undefined` return type rejects `async` layers at
 * compile time (an untyped thenable-returning caller still hits the runtime check in
 * `GameRuntime.chain`): call `next()` to run the inner layer (the next middleware or the
 * hook/handler itself); omit it to skip the hook/handler. Throwing is handled exactly like
 * a hook throw. Method syntax keeps the context parameter bivariant, as `DurationFn` does,
 * so game-typed and erased definitions stay mutually assignable.
 */
export type PhaseMiddleware<TState extends PhaseState, TPrivate, TOptions> = {
  run(ctx: MiddlewareContext<TState, TPrivate, TOptions>, next: () => void): undefined;
}["run"];

/** One client action accepted by a phase. */
export interface ActionDefinition<TState extends PhaseState, TPrivate, TOptions, TPayload> {
  /** `"player"` means any active player, including the host. */
  from: PlayerRole;
  /** Validates the whole action object (`type` plus flat fields). */
  payload: z.ZodType<TPayload>;
  /** Payload fields that hold free text; `textFilterMiddleware` checks exactly these. The framework never guesses. */
  textFields?: readonly string[];
  handler(ctx: ActionContext<TState, TPrivate, TOptions, TPayload>): void;
}

/** An audience action accepted by a phase: dispatched seatless through `GameRuntime.dispatchAudience`, refused from seats. */
export interface AudienceActionDefinition<TState extends PhaseState, TPrivate, TOptions, TPayload> {
  readonly from: "audience";
  /** Validates the whole action object (`type` plus flat fields). */
  payload: z.ZodType<TPayload>;
  handler(ctx: AudienceActionContext<TState, TPrivate, TOptions, TPayload>): void;
}

/** One entry of a phase's `actions` table: a seated player's action or an audience one. */
export type PhaseAction<TState extends PhaseState, TPrivate, TOptions> =
  | ActionDefinition<TState, TPrivate, TOptions, unknown>
  | AudienceActionDefinition<TState, TPrivate, TOptions, unknown>;

/**
 * Method syntax keeps the context parameter bivariant, so definitions for different states stay
 * assignable to an erased `GameDefinition<PhaseState, unknown, unknown>`.
 */
type DurationFn<TState extends PhaseState, TPrivate, TOptions> = {
  compute(ctx: GameContext<TState, TPrivate, TOptions>): number;
}["compute"];

/**
 * Picks the next host from the connected seats in seat order; return `undefined` to leave the room
 * without a host. An id that is not among `candidates` (stale, disconnected or never seated) is
 * ignored and the current host stays in place.
 */
export type HostPicker = (candidates: PlayerInfo[], rng: () => number) => string | undefined;

/** How the runtime picks a new host when the current one disconnects (`GameDefinition.hostMigration`). */
export type HostMigration = "oldest" | "next-seated" | "random" | "none" | HostPicker;

/** One phase of a game. */
export interface PhaseDefinition<TState extends PhaseState, TPrivate, TOptions> {
  /** Milliseconds, or computed on entry. The timer restarts on every entry. */
  duration?: number | DurationFn<TState, TPrivate, TOptions>;
  /**
   * Interval in ms between {@link PhaseDefinition.onTick} calls; default 100 (10 Hz).
   * Must be an integer >= 1 and is ignored without `onTick`. Restarted on every entry.
   */
  tickMs?: number;
  onEnter?(ctx: GameContext<TState, TPrivate, TOptions>): void;
  /**
   * Called every {@link PhaseDefinition.tickMs} while the phase is active (for real-time phases),
   * with the tick interval in ms as `dtMs` — a fixed nominal value, not wall-clock elapsed time,
   * so integrating state by it (`pos += speed * dtMs / 1000`) is deterministic. Tick k fires at
   * enter + k·tickMs; `replayLog` reproduces the same ticks because replay clock advances fire
   * exactly the due ones between logged entries. Stops as soon as the phase is left (including a
   * transition queued from within `onTick`) and on `GameRuntime.stop`. Not wrapped by phase
   * middleware, like `onPlayerSync`; read absolute time with `ctx.now()` when you need it.
   */
  onTick?(ctx: GameContext<TState, TPrivate, TOptions>, dtMs: number): void;
  /** Required when `duration` is set. */
  onTimeout?(ctx: GameContext<TState, TPrivate, TOptions>): void;
  /** Any join, leave, connect, disconnect or ready change while in this phase. */
  onRosterChange?(ctx: GameContext<TState, TPrivate, TOptions>): void;
  actions?: Record<string, PhaseAction<TState, TPrivate, TOptions>>;
}

/** A complete game, as written by a game author. */
export interface GameDefinition<
  TState extends PhaseState,
  TPrivate = Record<string, never>,
  TOptions = Record<string, unknown>,
> {
  name: string;
  /** Bump when a change would alter how a recorded log replays. */
  version: string;
  /** Hash of the content this game plays from (for example its data files); recorded in exported replay bundles so a viewer can verify it played the same content. Default `""`. */
  contentHash?: () => string;
  minPlayers: number;
  maxPlayers: number;
  /** Phase entered by `START_GAME`. */
  startPhase: string;
  /** Start as soon as everyone is ready and `minPlayers` is met, without the host pressing Start. Default false. */
  autoStart?: boolean;
  /**
   * Who becomes host when the current one disconnects. `"next-seated"` (the default) keeps the
   * historical order: first connected seat that is active and ready, else the first connected
   * ready seat, else the first connected seat. `"oldest"` takes the first connected seat
   * regardless of ready or active; `"random"` draws one with the room's seeded RNG (replayable);
   * `"none"` leaves the room without a host until the old host returns (a removed old host keeps
   * it that way — there is no recovery); a function picks from the connected seats itself.
   */
  hostMigration?: HostMigration;
  /** Parses the room-create options. Omit for a game without options. */
  options?: z.ZodType<TOptions>;
  /** The room's text-filter level, from the parsed options (e.g. a host-picked lobby option). Default `"off"`. */
  filterLevel?(options: TOptions): FilterLevel;
  /** Synchronously gates every join, including spectators and creation joins (which come through `onJoin`); see {@link CanJoinInput}. */
  canJoin?(input: CanJoinInput): CanJoinResult;
  /** Replaces the core-owned messages (lobby built-ins, runtime refusals); see {@link CoreStrings}. `defineGame` fills in the defaults. */
  strings?: Partial<CoreStrings>;
  /** Called once per room (and per replay table); must return a fresh object each call, never a shared one: the action log and phase timings are keyed by it. */
  createPrivateState(): TPrivate;
  /** `"Lobby"` is reserved and built in. */
  phases: Record<string, PhaseDefinition<TState, TPrivate, TOptions>>;
  /** Optional middleware wrapping phase hooks and action handlers. First registered is outermost. */
  middleware?: PhaseMiddleware<TState, TPrivate, TOptions>[];
  /** After a player (re)connects: resend their private messages. */
  onPlayerSync?(ctx: GameContext<TState, TPrivate, TOptions>, playerId: string): void;
  onReturnToLobby?(ctx: GameContext<TState, TPrivate, TOptions>): void;
  /** The host sent `END_GAME`; runs before `onReturnToLobby`. Use it to tell players why the game stopped. */
  onEndGame?(ctx: GameContext<TState, TPrivate, TOptions>): void;
  /**
   * Runs after a hook, handler, middleware or timer threw, with the failure (an `AggregateError`
   * in original order when several failed in one run). Queueing a transition here replaces the
   * default return-to-Lobby policy; a throw in this hook is caught and joins the rethrow.
   */
  onError?(ctx: GameContext<TState, TPrivate, TOptions>, error: unknown): void;
}

declare const timerBrand: unique symbol;
/**
 * Opaque handle for a timer created by {@link RuntimeHost.setTimeout}. A branded
 * number: hosts brand their numeric id with a single `as`, and a plain number is
 * still a type error, so no double assertion is needed at any boundary.
 */
export type TimerHandle = number & { readonly [timerBrand]: true };

/** Everything the runtime needs from its environment. Implemented by the server; faked in tests. */
export interface RuntimeHost {
  players(): PlayerInfo[];
  /** Mark every ready seat active. */
  activateWaitingPlayers(): void;
  /** Mark every unready seat inactive; called when the game leaves the Lobby. */
  benchUnreadyPlayers(): void;
  send(playerId: string, type: string, payload: unknown): void;
  broadcast(type: string, payload: unknown): void;
  /** Called once per applied phase transition, after the `transition` middleware event; hosts record replay snapshots here and clear every {@link RuntimeHost.audienceOnce} scope. */
  notifyTransition(from: string, to: string): void;
  /**
   * True the first time `audienceKey` votes in `scope`, false afterwards; hosts clear every scope
   * when the phase changes (see {@link RuntimeHost.notifyTransition}). Backs `ctx.audience.once`
   * for audience actions. In-memory only — audience identity is never persisted.
   */
  audienceOnce(audienceKey: string, scope: string): boolean;
  showTo(playerId: string, ref: object): void;
  hideFrom(playerId: string, ref: object): void;
  /** Remove the seat and tell the player they were kicked. */
  kick(playerId: string): void;
  /** Make `playerId` the host and demote the current one; the runtime's host migration calls it (#36). Hosts that omit it (replay) never migrate. */
  setHost?(playerId: string): void;
  /** Make the (validated) room options visible to clients. */
  publishOptions(options: unknown): void;
  /** Sinks the room's log lines; when omitted the runtime uses {@link noopLogger}. */
  log?: Logger;
  now(): number;
  rng(): number;
  /** The room RNG seed (see `sfc32`); recorded in the action log header. */
  readonly seed: Seed;
  setTimeout(callback: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}
