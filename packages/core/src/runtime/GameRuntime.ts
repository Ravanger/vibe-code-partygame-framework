import {
  ActionEnvelopeSchema,
  END_GAME,
  ErrorCode,
  KICK_PLAYER,
  LOBBY_PHASE,
  type ServerError,
  ServerMessage,
} from "@partygame/shared";
import { createActor, setup } from "xstate";
import { prettifyError } from "zod";
import { Lobby } from "./lobby.js";
import type {
  ActionContext,
  ActionDefinition,
  GameContext,
  GameDefinition,
  MiddlewareContext,
  MiddlewareEvent,
  PhaseDefinition,
  PhaseMiddleware,
  PhaseState,
  RuntimeHost,
} from "./types.js";

const MAX_CHAINED_TRANSITIONS = 100;
const STOPPED_ERROR: ServerError = {
  code: ErrorCode.NOT_ALLOWED,
  message: "The game has ended",
};

interface PhaseActor {
  start(): void;
  stop(): void;
  send(event: { type: "GO"; phase: string }): void;
}

type Pending = { kind: "phase"; phase: string } | { kind: "lobby" };

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
  private readonly actor: PhaseActor;
  private readonly queue: Pending[] = [];
  private readonly failures: unknown[] = [];
  private readonly rejections: ServerError[] = [];
  private current: PhaseDefinition<TState, TPrivate, TOptions>;
  private phaseName: string = LOBBY_PHASE;
  private duration = 0;
  private stopped = false;
  private hasStarted = false;

  constructor(config: GameRuntimeConfig<TState, TPrivate, TOptions>) {
    this.spec = config.definition;
    this.state = config.state;
    this.host = config.host;
    this.options = config.options;
    this.priv = this.spec.createPrivateState();
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
    this.current = this.phases[LOBBY_PHASE] as PhaseDefinition<TState, TPrivate, TOptions>;
    this.actor = createActor(this.buildMachine(), {
      clock: {
        setTimeout: (callback, ms) => this.host.setTimeout(() => this.run(callback), ms),
        clearTimeout: (handle) => this.host.clearTimeout(handle),
      },
    });
    this.actor.start();
    this.refreshCanStart();
  }

  /** Name of the current phase. */
  get phase(): string {
    return this.phaseName;
  }

  /**
   * Handle a client `ACTION` message. Every rejection is sent to `playerId` as `ERROR`;
   * the first one is also returned so a request can answer with it.
   * After {@link GameRuntime.stop} every action fails with `NOT_ALLOWED`.
   */
  dispatch(playerId: string, rawAction: unknown): ServerError | undefined {
    if (this.stopped) return STOPPED_ERROR;
    this.rejections.length = 0;
    this.run(() => this.handle(playerId, rawAction));
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
    this.queue.length = 0;
    this.actor.stop();
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
      now: () => this.host.now(),
    };
  }

  /** Runs `inner` through the middleware onion; outermost first. Omitting `next()` skips everything inside. */
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
      } else {
        layer(this.middlewareContext(event), () => runLayer(index + 1));
      }
    };
    runLayer(0);
  }

  private middlewareContext(event: MiddlewareEvent): MiddlewareContext<TState, TPrivate, TOptions> {
    return { ...this.context(), event };
  }

  private rosterChange(): void {
    this.chain({ kind: "roster-change" }, () => this.current.onRosterChange?.(this.context()));
  }

  private buildMachine() {
    const delays: Record<string, () => number> = {};
    const states: Record<string, object> = {};
    for (const [name, phase] of Object.entries(this.phases)) {
      const node: Record<string, unknown> = {
        entry: () => this.guarded(() => this.enter(name, phase)),
      };
      if (phase.duration !== undefined) {
        delays[name] = () => this.duration;
        node.after = {
          [name]: {
            actions: () =>
              this.guarded(() =>
                this.chain({ kind: "timeout" }, () => this.current.onTimeout?.(this.context())),
              ),
          },
        };
      }
      states[name] = node;
    }
    return setup({
      types: { events: {} as { type: "GO"; phase: string } },
      delays,
    }).createMachine({
      id: "game",
      initial: LOBBY_PHASE,
      on: {
        GO: Object.keys(states).map((name) => ({
          guard: ({ event }: { event: { phase: string } }) => event.phase === name,
          target: `.${name}`,
          reenter: true,
        })),
      },
      states,
    });
  }

  private enter(name: string, phase: PhaseDefinition<TState, TPrivate, TOptions>): void {
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
  }

  private guarded(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      this.failures.push(error);
    }
  }

  private rethrowFailure(): void {
    const [failure] = this.failures.splice(0);
    if (failure !== undefined) throw failure;
  }

  private run(fn: () => void): void {
    try {
      fn();
      this.rethrowFailure();
      let steps = 0;
      for (let next = this.queue.shift(); next; next = this.queue.shift()) {
        if (++steps > MAX_CHAINED_TRANSITIONS) {
          throw new Error(`More than ${MAX_CHAINED_TRANSITIONS} chained transitions; phase loop?`);
        }
        this.apply(next);
        this.rethrowFailure();
      }
    } catch (error) {
      this.queue.length = 0;
      throw error;
    } finally {
      this.refreshCanStart();
    }
  }

  private refreshCanStart(): void {
    this.state.canStart = this.phaseName === LOBBY_PHASE && this.lobby.canStart(this.context());
  }

  private apply(next: Pending): void {
    if (next.kind === "lobby") {
      this.spec.onReturnToLobby?.(this.context());
      this.host.activateWaitingPlayers();
      this.actor.send({ type: "GO", phase: LOBBY_PHASE });
    } else {
      if (this.phaseName === LOBBY_PHASE) this.host.benchUnreadyPlayers();
      this.actor.send({ type: "GO", phase: next.phase });
    }
  }

  private handle(playerId: string, rawAction: unknown): void {
    const envelope = ActionEnvelopeSchema.safeParse(rawAction);
    if (!envelope.success) {
      this.reject(playerId, undefined, ErrorCode.INVALID_ACTION, "Malformed action");
      return;
    }
    const type = envelope.data.type;
    const action = this.builtins[type] ?? this.current.actions?.[type];
    if (!action) {
      const declaredElsewhere = Object.values(this.phases).some(
        (p) => p.actions && type in p.actions,
      );
      this.reject(
        playerId,
        type,
        declaredElsewhere ? ErrorCode.WRONG_PHASE : ErrorCode.UNKNOWN_ACTION,
        declaredElsewhere
          ? `${type} is not allowed in ${this.phaseName}`
          : `Unknown action ${type}`,
      );
      return;
    }
    const player = this.host.players().find((p) => p.id === playerId);
    if (!player || (action.from === "host" && player.role !== "host")) {
      this.reject(playerId, type, ErrorCode.UNAUTHORIZED, `Not allowed to send ${type}`);
      return;
    }
    if (!player.isActive) {
      this.reject(playerId, type, ErrorCode.NOT_ACTIVE, "You are waiting to be let in");
      return;
    }
    const payload = action.payload.safeParse(envelope.data);
    if (!payload.success) {
      this.reject(playerId, type, ErrorCode.INVALID_ACTION, prettifyError(payload.error));
      return;
    }
    const actionContext: ActionContext<TState, TPrivate, TOptions, unknown> = {
      ...this.context(),
      playerId,
      payload: payload.data,
      reject: (code, message) => this.reject(playerId, type, code, message),
    };
    this.chain({ kind: "action", actionType: type, senderId: playerId }, () =>
      action.handler(actionContext),
    );
  }

  private reject(
    playerId: string,
    action: string | undefined,
    code: ErrorCode,
    message: string,
  ): void {
    const error: ServerError = action === undefined ? { code, message } : { code, message, action };
    this.rejections.push(error);
    this.host.send(playerId, ServerMessage.ERROR, error);
  }
}
