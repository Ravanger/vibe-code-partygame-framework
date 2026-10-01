import { ErrorCode, SET_OPTIONS, START_GAME } from "@partygame/shared";
import { prettifyError, z } from "zod";
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

/** The built-in `Lobby` phase (`START_GAME`, `SET_OPTIONS`, optional auto-start) and the `KICK_PLAYER` action every phase accepts. */
export class Lobby<TState extends PhaseState, TPrivate, TOptions> {
  constructor(private readonly bindings: LobbyBindings<TState, TPrivate, TOptions>) {}

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
          ctx.reject(ErrorCode.NOT_ALLOWED, "You cannot kick yourself");
        } else if (!ctx.player(playerId)) {
          ctx.reject(ErrorCode.NOT_ALLOWED, "No such player");
        } else {
          this.bindings.host.kick(playerId);
          this.bindings.rosterChanged();
        }
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
          ctx.reject(
            ErrorCode.NOT_ENOUGH_PLAYERS,
            `Need at least ${definition.minPlayers} players to start`,
          );
          return;
        }
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
        const merged = { ...options.get(), ...partial };
        const parsed = definition.options ? definition.options.safeParse(merged) : undefined;
        if (parsed && !parsed.success) {
          ctx.reject(ErrorCode.INVALID_ACTION, prettifyError(parsed.error));
          return;
        }
        const next = (parsed ? parsed.data : merged) as TOptions;
        options.set(next);
        host.publishOptions(next);
      },
    };
  }
}
