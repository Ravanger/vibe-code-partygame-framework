import type { FilterLevel } from "@partygame/content/filter";
import {
  ActionEnvelopeSchema,
  CLIENT_MESSAGES,
  ErrorCode,
  FrameworkError,
} from "@partygame/shared";
import type {
  ActionContext,
  ActionDefinition,
  GameContext,
  MiddlewareEvent,
  PhaseState,
  PlayerInfo,
} from "./types.js";

/** Callbacks the pipeline uses to reach back into the runtime. */
interface DispatchPipelineDeps<TState extends PhaseState, TPrivate, TOptions> {
  /** Built-in actions available in every phase (kick, end game). */
  builtins: Record<string, ActionDefinition<TState, TPrivate, TOptions, unknown>>;
  /** The current phase's action table, or undefined when it declares none. */
  currentPhaseActions():
    | Record<string, ActionDefinition<TState, TPrivate, TOptions, unknown>>
    | undefined;
  /** Whether any phase declares `type` at all (drives WRONG_PHASE vs UNKNOWN_ACTION). */
  declaredInAnyPhase(type: string): boolean;
  /** The current phase name, for rejection messages. */
  phaseName(): string;
  players(): PlayerInfo[];
  contextFactory(): GameContext<TState, TPrivate, TOptions>;
  /** The room's current text-filter level (the definition's `filterLevel`, default `"off"`). */
  filterLevel(): FilterLevel;
  reject(playerId: string, action: string | undefined, code: ErrorCode, message: string): void;
  chain(event: MiddlewareEvent, inner: () => void): void;
}

/**
 * The action dispatch chain: envelope parse, action lookup, role and active checks, payload parse,
 * then the handler inside the middleware onion. Rejection codes, messages and their order are part
 * of the client contract.
 */
export class DispatchPipeline<TState extends PhaseState, TPrivate, TOptions> {
  constructor(private readonly deps: DispatchPipelineDeps<TState, TPrivate, TOptions>) {}

  /** Run one raw action through every step; rejections send `ERROR` to the sender via `deps.reject`. */
  run(playerId: string, rawAction: unknown): void {
    const envelope = ActionEnvelopeSchema.safeParse(rawAction);
    if (!envelope.success) {
      this.deps.reject(
        playerId,
        undefined,
        ErrorCode.INVALID_ACTION,
        CLIENT_MESSAGES.INVALID_ACTION,
      );
      return;
    }
    const type = envelope.data.type;
    const action = this.deps.builtins[type] ?? this.deps.currentPhaseActions()?.[type];
    if (!action) {
      const declaredElsewhere = this.deps.declaredInAnyPhase(type);
      throw new FrameworkError(
        declaredElsewhere ? ErrorCode.WRONG_PHASE : ErrorCode.UNKNOWN_ACTION,
        declaredElsewhere
          ? `${type} is not allowed in ${this.deps.phaseName()}`
          : `Unknown action ${type}`,
      );
    }
    const player = this.deps.players().find((p) => p.id === playerId);
    if (!player || (action.from === "host" && player.role !== "host")) {
      throw new FrameworkError(ErrorCode.UNAUTHORIZED, `Not allowed to send ${type}`);
    }
    if (!player.isActive) {
      throw new FrameworkError(ErrorCode.NOT_ACTIVE, "You are waiting to be let in");
    }
    const payload = action.payload.safeParse(envelope.data);
    if (!payload.success) {
      this.deps.reject(playerId, type, ErrorCode.INVALID_ACTION, CLIENT_MESSAGES.INVALID_ACTION);
      return;
    }
    const actionContext: ActionContext<TState, TPrivate, TOptions, unknown> = {
      ...this.deps.contextFactory(),
      playerId,
      payload: payload.data,
      reject: (code, message) => this.deps.reject(playerId, type, code, message),
    };
    this.deps.chain(
      {
        kind: "action",
        actionType: type,
        senderId: playerId,
        payload: payload.data,
        ...(action.textFields ? { textFields: action.textFields } : {}),
        filterLevel: this.deps.filterLevel(),
      },
      () => action.handler(actionContext),
    );
  }
}
