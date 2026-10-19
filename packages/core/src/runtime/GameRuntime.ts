import {
  CLIENT_MESSAGES,
  END_GAME,
  ErrorCode,
  FrameworkError,
  KICK_PLAYER,
  LOBBY_PHASE,
  type ServerError,
  ServerMessage,
} from "@partygame/shared";
import { createActor } from "xstate";
import { newId } from "../utils.js";
import { DispatchPipeline } from "./DispatchPipeline.js";
import { Lobby } from "./lobby.js";
import { buildPhaseMachine } from "./machineFactory.js";
import { type Pending, PhaseLoopError, TransitionQueue } from "./TransitionQueue.js";
import type {
  ActionDefinition,
  GameContext,
  GameDefinition,
  MiddlewareContext,
  MiddlewareEvent,
  PhaseDefinition,
  PhaseMiddleware,
  PhaseState,
  RejectOptions,
  RuntimeHost,
} from "./types.js";

const STOPPED_ERROR: ServerError = {
  code: ErrorCode.NOT_ALLOWED,
  message: "The game has ended",
};
const FAILURE_NOTICE = "The game stopped because of an unexpected error.";
/** `PhaseDefinition.tickMs` when a ticking phase does not set one: 10 Hz. */
const DEFAULT_TICK_MS = 100;

/** Thrown by the {@link GameRuntime} constructor when `createPrivateState()` returns a non-object. */
export class InvalidPrivateStateError extends Error {
  constructor() {
    super("createPrivateState() must return an object");
    this.name = "InvalidPrivateStateError";
  }
}

interface PhaseActor {
  start(): void;
  stop(): void;
  send(event: { type: "GO"; phase: string }): void;
}

/** Constructor argument of {@link GameRuntime}. */
export interface GameRuntimeConfig<TState extends PhaseState, TPrivate, TOptions> {
  definition: GameDefinition<TState, TPrivate, TOptions>;
  /** The synced state object; the runtime writes `phase` and `phaseEndsAt` into it. */
  state: TState;
  /** Room options, already parsed with `definition.options` when the game has one. */
  options: TOptions;
  host: RuntimeHost;
}

/**
 * Runs one game room. An XState actor generated from the definition owns the current phase and its timer;
 * hooks and handlers run inside it, and the transitions they request are applied once they return.
 * Starts in `Lobby` on construction. Call {@link GameRuntime.stop} when the room is disposed.
 */
export class GameRuntime<TState extends PhaseState, TPrivate, TOptions = Record<string, unknown>> {
  readonly priv: TPrivate;
  private readonly spec: GameDefinition<TState, TPrivate, TOptions>;
  private readonly state: TState;
  private options: TOptions;
  private readonly host: RuntimeHost;
  private readonly lobby: Lobby<TState, TPrivate, TOptions>;
  private readonly builtins: Record<string, ActionDefinition<TState, TPrivate, TOptions, unknown>>;
  private readonly phases: Record<string, PhaseDefinition<TState, TPrivate, TOptions>>;
  private readonly middleware: PhaseMiddleware<TState, TPrivate, TOptions>[];
  private readonly pipeline: DispatchPipeline<TState, TPrivate, TOptions>;
  private readonly actor: PhaseActor;
  private readonly queue = new TransitionQueue();
  private readonly failures: unknown[] = [];
  private readonly rejections: ServerError[] = [];
  /** Rejections this dispatch recorded with `redactPayload`; reset like `rejections`. */
  private redactedRejections = 0;
  private current: PhaseDefinition<TState, TPrivate, TOptions>;
  private phaseName: string = LOBBY_PHASE;
  private duration = 0;
  /** Pending `onTick` timer of the current phase, while it has one. */
  private tickHandle: unknown = undefined;
  private stopped = false;
  private hasStarted = false;
  private lobbyReturnFailed = false;

  constructor(config: GameRuntimeConfig<TState, TPrivate, TOptions>) {
    this.spec = config.definition;
    this.state = config.state;
    this.host = config.host;
    this.options = config.options;
    const priv = this.spec.createPrivateState();
    if (typeof priv !== "object" || priv === null) throw new InvalidPrivateStateError();
    this.priv = priv;
    this.lobby = new Lobby<TState, TPrivate, TOptions>({
      definition: this.spec,
      host: this.host,
      options: {
        get: () => this.options,
        set: (next) => {
          this.options = next;
        },
      },
      hasStarted: () => this.hasStarted,
      rosterChanged: () => this.rosterChange(),
    });
    this.middleware = this.spec.middleware ?? [];
    this.builtins = {
      [KICK_PLAYER]: this.lobby.kickAction(),
      [END_GAME]: this.lobby.endGameAction(),
    };
    this.phases = { ...this.spec.phases, [LOBBY_PHASE]: this.lobby.phase() };
    this.pipeline = new DispatchPipeline<TState, TPrivate, TOptions>({
      builtins: this.builtins,
      currentPhaseActions: () => this.current.actions,
      declaredInAnyPhase: (type) =>
        Object.values(this.phases).some((p) => p.actions && type in p.actions),
      phaseName: () => this.phaseName,
      players: () => this.host.players(),
      contextFactory: () => this.context(),
      filterLevel: () => this.spec.filterLevel?.(this.options) ?? "off",
      reject: (playerId, action, code, message) => this.reject(playerId, action, code, message),
      chain: (event, inner) => this.chain(event, () => this.rejectThrown(event, inner)),
    });
    this.current = this.phases[LOBBY_PHASE] as PhaseDefinition<TState, TPrivate, TOptions>;
    this.actor = createActor(
      buildPhaseMachine({
        phases: this.phases,
        enter: (name) =>
          this.enter(name, this.phases[name] as PhaseDefinition<TState, TPrivate, TOptions>),
        timeout: () =>
          this.chain({ kind: "timeout" }, () => this.current.onTimeout?.(this.context())),
        duration: () => this.duration,
        guard: (fn) => this.guarded(fn),
      }),
      {
        clock: {
          setTimeout: (callback, ms) => this.host.setTimeout(() => this.run(callback), ms),
          clearTimeout: (handle) => this.host.clearTimeout(handle),
        },
      },
    );
    try {
      this.run(() => this.actor.start());
    } catch {
      // Already reported to onError and the failure policy; a broken initial enter must not kill construction.
    }
  }

  /** Name of the current phase. */
  get phase(): string {
    return this.phaseName;
  }

  /**
   * Handle a client `ACTION` message. Every rejection is sent to `playerId` as `ERROR`;
   * the first one is also returned so a request can answer with it. A {@link FrameworkError}
   * thrown by the pipeline or a handler answers with its code and the fixed client message,
   * without running the failure policy. After {@link GameRuntime.stop} every action fails
   * with `NOT_ALLOWED`.
   */
  dispatch(playerId: string, rawAction: unknown): ServerError | undefined {
    if (this.stopped) return STOPPED_ERROR;
    this.rejections.length = 0;
    this.redactedRejections = 0;
    try {
      this.run(() => this.handle(playerId, rawAction), true);
    } catch (error) {
      if (!(error instanceof FrameworkError)) throw error;
      return this.recordFrameworkError(playerId, error);
    }
    return this.rejections[0];
  }

  /** Call after any join, leave, connect, disconnect or ready change. */
  rosterChanged(): void {
    if (this.stopped) return;
    this.run(() => this.rosterChange());
  }

  /** Call after a player (re)connects so the game can resend their private messages. */
  syncPlayer(playerId: string): void {
    if (this.stopped) return;
    this.run(() => this.spec.onPlayerSync?.(this.context(), playerId));
  }

  /** Stop the actor and clear every timer. The runtime ignores all further calls. */
  stop(): void {
    this.stopped = true;
    this.queue.clear();
    this.actor.stop();
    this.clearTick();
  }

  private context(): GameContext<TState, TPrivate, TOptions> {
    return {
      state: this.state,
      priv: this.priv,
      options: this.options,
      phase: this.phaseName,
      players: () => this.host.players(),
      activePlayers: () =>
        this.host.players().filter((p) => p.isConnected && p.isReady && p.isActive),
      player: (id) => this.host.players().find((p) => p.id === id),
      activateWaitingPlayers: () => this.host.activateWaitingPlayers(),
      send: (playerId, type, payload) => this.host.send(playerId, type, payload),
      broadcast: (type, payload) => this.host.broadcast(type, payload),
      showTo: (playerId, ref) => this.host.showTo(playerId, ref),
      hideFrom: (playerId, ref) => this.host.hideFrom(playerId, ref),
      transition: (phase) => {
        if (!Object.hasOwn(this.phases, phase)) throw new Error(`Unknown phase "${phase}"`);
        this.queue.push({ kind: "phase", phase });
      },
      returnToLobby: () => {
        this.queue.push({ kind: "lobby" });
      },
      rng: () => this.host.rng(),
      newId: () => newId(() => this.host.rng()),
      now: () => this.host.now(),
      gameName: this.spec.name,
      gameVersion: this.spec.version,
      seed: this.host.seed,
    };
  }

  /**
   * Runs `inner` through the middleware onion; outermost first. Omitting `next()` skips everything inside.
   * Each layer's `next()` may be called at most once per event, and a layer that returns a Promise throws —
   * the chain is synchronous.
   */
  private chain(event: MiddlewareEvent, inner: () => void): void {
    if (this.middleware.length === 0) {
      inner();
      return;
    }
    const layers = this.middleware;
    const runLayer = (index: number): void => {
      const layer = layers[index];
      if (layer === undefined) {
        inner();
        return;
      }
      let nexted = false;
      const result: unknown = layer(this.middlewareContext(event), () => {
        if (nexted) {
          throw new Error(`middleware[${index}] called next() twice for one ${event.kind} event`);
        }
        nexted = true;
        runLayer(index + 1);
      });
      if (result && typeof (result as PromiseLike<unknown>).then === "function") {
        throw new Error(
          `middleware[${index}] returned a Promise; the middleware chain is synchronous`,
        );
      }
    };
    runLayer(0);
  }

  private middlewareContext(event: MiddlewareEvent): MiddlewareContext<TState, TPrivate, TOptions> {
    const rejections = this.rejections;
    // A getter shorthand binds `this` to the returned context object, so the live counter is
    // read through a captured reference to the runtime.
    const runtime = this;
    return {
      ...this.context(),
      event,
      // Live view of the dispatch's rejection list (dispatch resets it before every handle).
      get rejectionCount() {
        return rejections.length;
      },
      get redactedRejectionCount() {
        return runtime.redactedRejections;
      },
      reject: (code, message, options) => this.middlewareReject(event, code, message, options),
    };
  }

  /** Middleware rejections target the action's sender; other event kinds have no one to tell. */
  private middlewareReject(
    event: MiddlewareEvent,
    code: ErrorCode,
    message: string,
    options?: RejectOptions,
  ): void {
    if (event.kind !== "action")
      throw new Error("ctx.reject() is only available for action events");
    this.reject(event.senderId, event.actionType, code, message, options?.redactPayload);
  }

  private rosterChange(): void {
    this.chain({ kind: "roster-change" }, () => this.current.onRosterChange?.(this.context()));
  }

  private enter(name: string, phase: PhaseDefinition<TState, TPrivate, TOptions>): void {
    this.clearTick();
    this.phaseName = name;
    this.hasStarted ||= name !== LOBBY_PHASE;
    this.current = phase;
    this.state.phase = name;
    if (phase.duration === undefined) {
      this.duration = 0;
      this.state.phaseEndsAt = 0;
    } else {
      this.duration =
        typeof phase.duration === "function" ? phase.duration(this.context()) : phase.duration;
      this.state.phaseEndsAt = this.host.now() + this.duration;
    }
    this.chain({ kind: "enter" }, () => phase.onEnter?.(this.context()));
    this.startTicks(phase);
  }

  /** Cancels the pending `onTick` timer, if the current phase has one. */
  private clearTick(): void {
    if (this.tickHandle === undefined) return;
    this.host.clearTimeout(this.tickHandle);
    this.tickHandle = undefined;
  }

  /**
   * Arms the first `onTick` of a ticking phase, one interval after entry. Each tick reschedules
   * the next, so tick k fires at enter + k·tickMs (the replay clock reproduces exactly those).
   * Ticks stop when the phase is left: every transition and `stop()` clears the pending timer,
   * including one scheduled by a tick that itself queued the transition.
   */
  private startTicks(phase: PhaseDefinition<TState, TPrivate, TOptions>): void {
    const onTick = phase.onTick;
    if (onTick === undefined) return;
    const dtMs = phase.tickMs ?? DEFAULT_TICK_MS;
    const step = (): void => {
      this.run(() => {
        onTick(this.context(), dtMs);
        this.tickHandle = this.host.setTimeout(step, dtMs);
      });
    };
    this.tickHandle = this.host.setTimeout(step, dtMs);
  }

  private guarded(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      this.failures.push(error);
    }
  }

  /** Run a queued transition, collecting a direct throw (an unguarded `onReturnToLobby`) as a failure. */
  private applyGuarded(next: Pending): void {
    try {
      this.apply(next);
    } catch (error) {
      this.failures.push(error);
    }
  }

  /** The default failure policy: a fixed notice, and the Lobby when not already there. */
  private defaultFailurePolicy(): void {
    this.state.notice = FAILURE_NOTICE;
    if (this.phaseName === LOBBY_PHASE) return;
    if (!this.lobbyReturnFailed) {
      this.guarded(() => this.observeTransition(this.phaseName, LOBBY_PHASE));
      this.guarded(() => this.spec.onReturnToLobby?.(this.context()));
    }
    this.guarded(() => this.host.activateWaitingPlayers());
    this.guarded(() => this.actor.send({ type: "GO", phase: LOBBY_PHASE }));
  }

  /**
   * One failed run: report every collected failure to `onError` once, then apply the default
   * policy unless `onError` queued its own transition, and rethrow what was reported so callers
   * (`dispatch`, `GameRoom.act`) still see the failure. Failures raised by `onError` or the
   * policy itself join the rethrow; they are logged, not recursed on.
   */
  private failRun(): void {
    const failed = this.failures.splice(0);
    let reported: unknown =
      failed.length === 1 ? failed[0] : new AggregateError(failed, "Game hook failed");
    this.queue.clear();
    this.guarded(() => this.spec.onError?.(this.context(), reported));
    if (this.queue.isEmpty() || !this.drainFailureTransitions()) this.defaultFailurePolicy();
    this.lobbyReturnFailed = false;
    const extra = this.failures.splice(0);
    if (extra.length > 0) reported = new AggregateError([...failed, ...extra], "Game hook failed");
    throw reported;
  }

  /** Applies what `onError` queued; false when it looped, so the caller falls back to the default policy. */
  private drainFailureTransitions(): boolean {
    try {
      this.queue.drain(
        (next) => this.applyGuarded(next),
        () => {},
      );
      return true;
    } catch (error) {
      this.failures.push(error);
      return false;
    }
  }

  private drainRun(): void {
    try {
      this.queue.drain(
        (next) => this.applyGuarded(next),
        () => {
          if (this.failures.length > 0) this.failRun();
        },
      );
    } catch (error) {
      if (!(error instanceof PhaseLoopError)) throw error;
      this.failures.push(error);
      this.failRun();
    }
  }

  private run(fn: () => void, typedOutcome = false): void {
    try {
      try {
        fn();
      } catch (error) {
        if (typedOutcome && error instanceof FrameworkError) {
          this.queue.clear();
          throw error;
        }
        this.failures.push(error);
      }
      if (this.failures.length > 0) this.failRun();
      this.drainRun();
    } finally {
      this.refreshCanStart();
    }
  }

  private refreshCanStart(): void {
    this.state.canStart = this.phaseName === LOBBY_PHASE && this.lobby.canStart(this.context());
  }

  private observeTransition(from: string, to: string): void {
    this.chain({ kind: "transition", from, to }, () => {});
  }

  private apply(next: Pending): void {
    // An observer throw must not cancel the transition it observes (docs: middleware cannot veto);
    // defer it like any hook failure and let the transition apply, then surface via failRun.
    this.guarded(() =>
      this.observeTransition(this.phaseName, next.kind === "lobby" ? LOBBY_PHASE : next.phase),
    );
    if (next.kind === "lobby") {
      this.lobbyReturnFailed = true;
      this.spec.onReturnToLobby?.(this.context());
      this.host.activateWaitingPlayers();
      this.actor.send({ type: "GO", phase: LOBBY_PHASE });
      this.lobbyReturnFailed = false;
    } else {
      if (this.phaseName === LOBBY_PHASE) this.host.benchUnreadyPlayers();
      this.actor.send({ type: "GO", phase: next.phase });
    }
  }

  private handle(playerId: string, rawAction: unknown): void {
    this.pipeline.run(playerId, rawAction);
  }

  /** Inside the chain, so middleware sees a handler-thrown FrameworkError as a rejection. */
  private rejectThrown(event: MiddlewareEvent, inner: () => void): void {
    try {
      inner();
    } catch (error) {
      if (!(error instanceof FrameworkError) || event.kind !== "action") throw error;
      this.queue.clear();
      this.recordFrameworkError(event.senderId, error);
    }
  }

  private recordFrameworkError(playerId: string, error: FrameworkError): ServerError {
    const serverError: ServerError = { code: error.code, message: CLIENT_MESSAGES[error.code] };
    this.rejections.push(serverError);
    this.host.send(playerId, ServerMessage.ERROR, serverError);
    return serverError;
  }

  private reject(
    playerId: string,
    action: string | undefined,
    code: ErrorCode,
    message: string,
    redactPayload?: boolean,
  ): void {
    const error: ServerError = action === undefined ? { code, message } : { code, message, action };
    this.rejections.push(error);
    if (redactPayload) ++this.redactedRejections;
    this.host.send(playerId, ServerMessage.ERROR, error);
  }
}
