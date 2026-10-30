import type { FilterLevel } from "@partygame/content/filter";
import {
  ActionEnvelopeSchema,
  CLIENT_MESSAGES,
  ErrorCode,
  FrameworkError,
} from "@partygame/shared";
import { type CoreStrings, mergeCoreStrings } from "./strings.js";
import type {
  ActionContext,
  ActionDefinition,
  AudienceActionContext,
  GameContext,
  MiddlewareEvent,
  PhaseAction,
  PhaseState,
  PlayerInfo,
} from "./types.js";

/** Callbacks the pipeline uses to reach back into the runtime. */
interface DispatchPipelineDeps<TState extends PhaseState, TPrivate, TOptions> {
  /** Built-in actions available in every phase (kick, end game). */
  builtins: Record<string, ActionDefinition<TState, TPrivate, TOptions, unknown>>;
  /** The current phase's action table, or undefined when it declares none. */
  currentPhaseActions(): Record<string, PhaseAction<TState, TPrivate, TOptions>> | undefined;
  /** Whether any phase declares `type` at all (drives WRONG_PHASE vs UNKNOWN_ACTION). */
  declaredInAnyPhase(type: string): boolean;
  /** The current phase name, for rejection messages. */
  phaseName(): string;
  players(): PlayerInfo[];
  /** The definition's strings table (merged or partial); the refusal messages come from it, defaults to English when omitted. */
  strings?: Partial<CoreStrings>;
  contextFactory(): GameContext<TState, TPrivate, TOptions>;
  /** The room's current text-filter level (the definition's `filterLevel`, default `"off"`). */
  filterLevel(): FilterLevel;
  /** True the first time `audienceKey` uses `scope`; see `RuntimeHost.audienceOnce`. */
  audienceOnce(audienceKey: string, scope: string): boolean;
  reject(playerId: string, action: string | undefined, code: ErrorCode, message: string): void;
  chain(event: MiddlewareEvent, inner: () => void): void;
}

/**
 * The action dispatch chain: envelope parse, action lookup, role and active checks, payload parse,
 * then the handler inside the middleware onion. Rejection codes, messages and their order are part
 * of the client contract.
 */
export class DispatchPipeline<TState extends PhaseState, TPrivate, TOptions> {
  /** The definition's `strings` over the defaults; the refusal messages come from it. */
  private readonly strings: CoreStrings;

  constructor(private readonly deps: DispatchPipelineDeps<TState, TPrivate, TOptions>) {
    this.strings = mergeCoreStrings(deps.strings);
  }

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
    const action = this.lookup(type);
    if (action.from === "audience") {
      throw new FrameworkError(ErrorCode.NOT_ALLOWED, this.strings.audienceActionFromSeat(type));
    }
    const player = this.deps.players().find((p) => p.id === playerId);
    if (!player || (action.from === "host" && player.role !== "host")) {
      throw new FrameworkError(ErrorCode.UNAUTHORIZED, this.strings.notAllowedToSend(type));
    }
    if (!player.isActive) {
      throw new FrameworkError(ErrorCode.NOT_ACTIVE, this.strings.waitingToBeLetIn);
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

  /**
   * Run one raw audience action through the same steps as {@link run}, for a seatless sender
   * identified by `audienceKey`. Only actions declared `from: "audience"` are accepted; the
   * handler receives an {@link AudienceActionContext} (no `playerId`), and the middleware event
   * and action log carry `audienceKey` as `senderId`.
   */
  runAudience(audienceKey: string, rawAction: unknown): void {
    const envelope = ActionEnvelopeSchema.safeParse(rawAction);
    if (!envelope.success) {
      this.deps.reject(
        audienceKey,
        undefined,
        ErrorCode.INVALID_ACTION,
        CLIENT_MESSAGES.INVALID_ACTION,
      );
      return;
    }
    const type = envelope.data.type;
    const action = this.lookup(type);
    if (action.from !== "audience") {
      throw new FrameworkError(ErrorCode.UNAUTHORIZED, this.strings.notAllowedToSend(type));
    }
    const payload = action.payload.safeParse(envelope.data);
    if (!payload.success) {
      this.deps.reject(audienceKey, type, ErrorCode.INVALID_ACTION, CLIENT_MESSAGES.INVALID_ACTION);
      return;
    }
    const actionContext: AudienceActionContext<TState, TPrivate, TOptions, unknown> = {
      ...this.deps.contextFactory(),
      payload: payload.data,
      audience: { once: (scope) => this.deps.audienceOnce(audienceKey, scope) },
      reject: (code, message) => this.deps.reject(audienceKey, type, code, message),
    };
    this.deps.chain(
      {
        kind: "action",
        actionType: type,
        senderId: audienceKey,
        payload: payload.data,
        filterLevel: this.deps.filterLevel(),
      },
      () => action.handler(actionContext),
    );
  }

  /** Find `type` in the built-ins or the current phase; throws WRONG_PHASE/UNKNOWN_ACTION otherwise. */
  private lookup(type: string): PhaseAction<TState, TPrivate, TOptions> {
    const action = this.deps.builtins[type] ?? this.deps.currentPhaseActions()?.[type];
    if (!action) {
      const declaredElsewhere = this.deps.declaredInAnyPhase(type);
      throw new FrameworkError(
        declaredElsewhere ? ErrorCode.WRONG_PHASE : ErrorCode.UNKNOWN_ACTION,
        declaredElsewhere
          ? this.strings.notAllowedInPhase(type, this.deps.phaseName())
          : this.strings.unknownAction(type),
      );
    }
    return action;
  }
}
