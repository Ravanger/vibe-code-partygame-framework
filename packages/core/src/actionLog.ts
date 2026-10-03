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
