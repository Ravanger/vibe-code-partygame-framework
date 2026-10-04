import type { MiddlewareContext, PhaseMiddleware, PhaseState } from "./runtime/index.js";

/** The key under which the action-log middleware stores its record in `ctx.priv`. */
export const ACTION_LOG = "actionLog" as const;

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
  /** `ctx.now()` at the first entry (the construction-time Lobby enter). */
  startedAt: number;
}

/** The complete record of one room session. JSON-serializable. */
export interface ActionLog {
  header: ActionLogHeader;
  /**
   * Seat ids in seat order, captured when START_GAME was dispatched (once — a second start after
   * `returnToLobby` does not overwrite it). The live host is the first seat, and replay maps these
   * positionally to p1..pN, so senders re-dispatch against the matching replay seats. Absent from
   * lobby-only sessions; `replayLog` then requires `init.players`.
   */
  roster?: string[];
  entries: ActionLogEntry[];
}

/**
 * Reads the action log recorded under {@link ACTION_LOG}. Returns the stored object itself — a
 * stable reference across calls — or `undefined` when no event has been recorded yet.
 */
export function getActionLog(priv: unknown): ActionLog | undefined {
  // ACTION_LOG is added at runtime; it is not part of the game's declared private state.
  return (priv as Record<string, unknown>)[ACTION_LOG] as ActionLog | undefined;
}

function logOf(ctx: MiddlewareContext<PhaseState, unknown, unknown>): ActionLog {
  // ACTION_LOG is added at runtime; it is not part of the game's declared private state.
  const record = ctx.priv as Record<string, unknown>;
  let log = record[ACTION_LOG] as ActionLog | undefined;
  if (log === undefined) {
    log = {
      header: { seed: ctx.seed, game: ctx.gameName, startedAt: ctx.now() },
      entries: [],
    };
    record[ACTION_LOG] = log;
  }
  return log;
}

/**
 * Records every middleware-visible event — actions (type, sender, zod-parsed payload), transitions
 * (from/to), enters, timeouts and roster changes — into an append-only, JSON-serializable log in
 * `ctx.priv[ACTION_LOG]`. The header (seed, game name, start time) is written on the first entry.
 * Never touches `ctx.state`; the log stays server-side. Actions rejected before the handler chain
 * (malformed envelope, unknown action, unauthorized sender, inactive player, invalid payload) are not
 * logged; an action whose handler calls `ctx.reject()` has reached the chain and is logged — replaying
 * such a log throws at that entry's re-dispatch, because the rejection re-runs. See "Action log and
 * replay" in the framework guide.
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
        // The seats when the game starts, in seat order — what replay pre-seats.
        log.roster = ctx.players().map((seat) => seat.id);
      }
    } else if (event.kind === "transition") {
      entry.from = event.from;
      entry.to = event.to;
    }
    log.entries.push(entry);
    next();
  };
}
