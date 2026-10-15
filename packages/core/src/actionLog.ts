import {
  InvalidPrivateStateError,
  type MiddlewareContext,
  type PhaseMiddleware,
  type PhaseState,
} from "./runtime/index.js";

/** One log per `ctx.priv` object; the priv itself never gains a framework key. */
const logs = new WeakMap<object, ActionLog>();

/** The kind of event an {@link ActionLogEntry} records. */
export type ActionLogEntryKind = "action" | "transition" | "enter" | "timeout" | "roster-change";

/** One recorded event, in append order. */
export interface ActionLogEntry {
  /** 1-based position in the log. */
  seq: number;
  /** `ctx.now()` at record time. */
  t: number;
  /** Current phase; for `enter`, the phase being entered. */
  phase: string;
  kind: ActionLogEntryKind;
  /** `kind === "action"`: the action name. */
  actionType?: string;
  /** `kind === "action"`: the sender's playerId. */
  senderId?: string;
  /** `kind === "action"`: the zod-parsed action object (JSON-serializable). */
  payload?: unknown;
  /**
   * `kind === "action"`: true when the handler called `ctx.reject()` or threw a `FrameworkError` — the action ran but changed
   * nothing. Absent on accepted actions. `replayLog` expects a marked entry's re-dispatch to reject
   * as well, and throws on a mismatch in either direction.
   */
  rejected?: boolean;
  /** `kind === "transition"`: source phase. */
  from?: string;
  /** `kind === "transition"`: target phase. */
  to?: string;
}

/** Written on the first recorded event. */
export interface ActionLogHeader {
  /** Room RNG seed (mulberry32); replay uses it to reseed the runtime. */
  seed: number;
  /** Definition name; `replayLog` refuses a log recorded for another game. */
  game: string;
  /**
   * The definition's version; `replayLog` refuses a log with a different version, or one without
   * (recorded before versioning).
   */
  version?: string;
  /** `ctx.now()` at the first entry (the construction-time Lobby enter). */
  startedAt: number;
}

/** One recorded seat at START_GAME time: the id plus the flags replay restores when pre-seating. */
export interface RosterSeat {
  /** The seat's playerId (a client-generated UUID in real rooms). */
  id: string;
  isConnected: boolean;
  isReady: boolean;
  isActive: boolean;
}

/** The complete record of one room session. JSON-serializable. */
export interface ActionLog {
  header: ActionLogHeader;
  /**
   * The seats in seat order, captured when START_GAME was dispatched (once — a second start after
   * `returnToLobby` does not overwrite it). Each entry records the seat's flags at that moment so
   * replay pre-seats them and the replayed bench-on-start and `activePlayers()` reads match live.
   * The live host is the first seat, and replay maps the ids positionally to p1..pN, so senders
   * re-dispatch against the matching replay seats. Absent from lobby-only sessions; `replayLog`
   * then requires `init.players`.
   */
  roster?: RosterSeat[];
  entries: ActionLogEntry[];
}

/**
 * Reads the action log recorded for a runtime's private state. Returns the stored object itself —
 * a stable reference across calls — or `undefined` when no event has been recorded yet (or the
 * priv is not an object).
 */
export function getActionLog(priv: unknown): ActionLog | undefined {
  if (typeof priv !== "object" || priv === null) return undefined;
  return logs.get(priv);
}

function logOf(ctx: MiddlewareContext<PhaseState, unknown, unknown>): ActionLog {
  const priv = ctx.priv;
  if (typeof priv !== "object" || priv === null) throw new InvalidPrivateStateError();
  let log = logs.get(priv);
  if (log === undefined) {
    log = {
      header: {
        seed: ctx.seed,
        game: ctx.gameName,
        version: ctx.gameVersion,
        startedAt: ctx.now(),
      },
      entries: [],
    };
    logs.set(priv, log);
  }
  return log;
}

/**
 * Records every middleware-visible event — actions (type, sender, zod-parsed payload), transitions
 * (from/to), enters, timeouts and roster changes — into an append-only, JSON-serializable log kept
 * outside `ctx.priv` (a module-level store keyed by it). The header (seed, game name, start time)
 * is written on the first entry.
 * Never touches `ctx.state`; the log stays server-side. Actions rejected before the handler chain
 * (malformed envelope, unknown action, unauthorized sender, inactive player, invalid payload) are not
 * logged; an action whose handler calls `ctx.reject()` or throws a `FrameworkError` has reached the
 * chain and is logged with `rejected: true`, so such logs replay — the re-dispatch re-runs the handler (RNG draws included)
 * and must reject again. See "Action log and replay" in the framework guide.
 */
export function actionLogMiddleware(): PhaseMiddleware<PhaseState, unknown, unknown> {
  return (ctx, next) => {
    const log = logOf(ctx);
    const event = ctx.event;
    const entry: ActionLogEntry = {
      seq: log.entries.length + 1,
      t: ctx.now(),
      phase: ctx.phase,
      kind: event.kind,
    };
    if (event.kind === "action") {
      entry.actionType = event.actionType;
      entry.senderId = event.senderId;
      entry.payload = event.payload;
      if (event.actionType === "START_GAME" && log.roster === undefined) {
        // The seats when the game starts, in seat order — what replay pre-seats. The flags are
        // recorded too: replay restores them so its bench-on-start matches live's exactly.
        log.roster = ctx.players().map((seat) => ({
          id: seat.id,
          isConnected: seat.isConnected,
          isReady: seat.isReady,
          isActive: seat.isActive,
        }));
      }
    } else if (event.kind === "transition") {
      entry.from = event.from;
      entry.to = event.to;
    }
    log.entries.push(entry);
    next();
    if (event.kind === "action" && ctx.rejectionCount > 0) {
      entry.rejected = true;
    }
  };
}
