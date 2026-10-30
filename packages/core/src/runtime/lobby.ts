import {
  CLIENT_MESSAGES,
  ErrorCode,
  FrameworkError,
  LOBBY_PHASE,
  MAX_OPTIONS_JSON_LENGTH,
  SET_OPTIONS,
  START_GAME,
} from "@partygame/shared";
import { z } from "zod";
import { type CoreStrings, mergeCoreStrings } from "./strings.js";
import type {
  ActionDefinition,
  GameContext,
  GameDefinition,
  PhaseDefinition,
  PhaseState,
  RuntimeHost,
} from "./types.js";

/** What the {@link Lobby} needs from the runtime that owns it. */
export interface LobbyBindings<TState extends PhaseState, TPrivate, TOptions> {
  definition: GameDefinition<TState, TPrivate, TOptions>;
  host: RuntimeHost;
  options: { get(): TOptions; set(next: TOptions): void };
  hasStarted(): boolean;
  /** Runs the current phase's `onRosterChange`. */
  rosterChanged(): void;
}

/** The built-in `Lobby` phase (`START_GAME`, `SET_OPTIONS`, optional auto-start) and the `KICK_PLAYER` and `END_GAME` actions. */
export class Lobby<TState extends PhaseState, TPrivate, TOptions> {
  /** The definition's `strings` over the defaults; the built-in refusals come from it. */
  private readonly strings: CoreStrings;

  constructor(private readonly bindings: LobbyBindings<TState, TPrivate, TOptions>) {
    this.strings = mergeCoreStrings(bindings.definition.strings);
  }

  /** The rule `START_GAME` enforces; published to clients as `state.canStart`. */
  canStart(ctx: GameContext<TState, TPrivate, TOptions>): boolean {
    return ctx.activePlayers().length >= this.bindings.definition.minPlayers;
  }

  phase(): PhaseDefinition<TState, TPrivate, TOptions> {
    const { definition, hasStarted } = this.bindings;
    return {
      actions: { [START_GAME]: this.startGame(), [SET_OPTIONS]: this.setOptions() },
      onRosterChange: (ctx) => {
        const everyoneReady = ctx.players().every((p) => p.isReady);
        if (definition.autoStart && !hasStarted() && everyoneReady && this.canStart(ctx)) {
          ctx.transition(definition.startPhase);
        }
      },
    };
  }

  kickAction(): ActionDefinition<TState, TPrivate, TOptions, { playerId: string }> {
    return {
      from: "host",
      payload: z.object({ playerId: z.string() }),
      handler: (ctx) => {
        const { playerId } = ctx.payload;
        if (playerId === ctx.playerId) {
          ctx.reject(ErrorCode.NOT_ALLOWED, this.strings.cannotKickSelf);
        } else if (!ctx.player(playerId)) {
          ctx.reject(ErrorCode.NOT_ALLOWED, this.strings.noSuchPlayer);
        } else {
          this.bindings.host.kick(playerId);
          this.bindings.rosterChanged();
        }
      },
    };
  }

  endGameAction(): ActionDefinition<TState, TPrivate, TOptions, unknown> {
    const { definition } = this.bindings;
    return {
      from: "host",
      payload: z.object({}),
      handler: (ctx) => {
        if (ctx.phase === LOBBY_PHASE) {
          throw new FrameworkError(ErrorCode.WRONG_PHASE, this.strings.endGameInLobby);
        }
        definition.onEndGame?.(ctx);
        ctx.returnToLobby();
      },
    };
  }

  private startGame(): ActionDefinition<TState, TPrivate, TOptions, unknown> {
    const { definition } = this.bindings;
    return {
      from: "host",
      payload: z.object({}),
      handler: (ctx) => {
        if (!this.canStart(ctx)) {
          throw new FrameworkError(
            ErrorCode.NOT_ENOUGH_PLAYERS,
            this.strings.needAtLeast(definition.minPlayers),
          );
        }
        if (ctx.state.notice) ctx.state.notice = "";
        ctx.transition(definition.startPhase);
      },
    };
  }

  private setOptions(): ActionDefinition<TState, TPrivate, TOptions, Record<string, unknown>> {
    const { definition, options, host } = this.bindings;
    return {
      from: "host",
      payload: z.looseObject({}),
      handler: (ctx) => {
        const { type: _type, ...partial } = ctx.payload;
        if (!definition.options && Object.keys(partial).length > 0) {
          ctx.reject(ErrorCode.INVALID_ACTION, CLIENT_MESSAGES.INVALID_ACTION);
          return;
        }
        const merged = { ...options.get(), ...partial };
        const parsed = definition.options ? definition.options.safeParse(merged) : undefined;
        if (parsed && !parsed.success) {
          ctx.reject(ErrorCode.INVALID_ACTION, CLIENT_MESSAGES.INVALID_ACTION);
          return;
        }
        const next = (parsed ? parsed.data : merged) as TOptions;
        if (JSON.stringify(next).length > MAX_OPTIONS_JSON_LENGTH) {
          ctx.reject(ErrorCode.INVALID_ACTION, CLIENT_MESSAGES.INVALID_ACTION);
          return;
        }
        options.set(next);
        host.publishOptions(next);
      },
    };
  }
}
