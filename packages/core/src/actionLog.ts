import { LOBBY_PHASE, PROTOCOL_VERSION, START_GAME } from "@partygame/shared";
import { z } from "zod";
import {
  InvalidPrivateStateError,
  type MiddlewareContext,
  type PhaseMiddleware,
  type PhaseState,
} from "./runtime/index.js";
import { deepFreeze, type Seed } from "./utils.js";

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
  /** `kind === "action"`: the zod-parsed action object (JSON-serializable), stored as a frozen deep copy. */
  payload?: unknown;
  /**
   * `kind === "action"`: true when the handler called `ctx.reject()` or threw a `FrameworkError` — the action ran but changed
   * nothing. Absent on accepted actions. `replayLog` expects a marked entry's re-dispatch to reject
   * as well, and throws on a mismatch in either direction.
   */
  rejected?: boolean;
  /**
   * `kind === "action"`: true when the rejection asked for payload redaction (`ctx.reject` with
   * `redactPayload: true`) — the entry then carries no `payload`, so the rejected text never lands
   * in the log or a replay bundle. The action was refused before the handler ran, so it changed no
   * state and `replayLog` skips re-dispatching it. Implies `rejected: true`.
   */
  redacted?: boolean;
  /** `kind === "transition"`: source phase. */
  from?: string;
  /** `kind === "transition"`: target phase. */
  to?: string;
}

/** Written on the first recorded event. */
export interface ActionLogHeader {
  /** Room RNG seed (sfc32); replay uses it to reseed the runtime. */
  seed: Seed;
  /** Definition name; `replayLog` refuses a log recorded for another game. */
  game: string;
  /**
   * The definition's version; `replayLog` refuses a log with a different version, or one without
   * (recorded before versioning).
   */
  version?: string;
  /**
   * The framework's `PROTOCOL_VERSION` at record time; `replayLog` refuses a log with a different
   * one, or one without (recorded before protocol versioning).
   */
  protocolVersion?: number;
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

/** One recorded seat: the id plus the flags replay restores when pre-seating. */
const RosterSeatSchema = z.strictObject({
  id: z.string(),
  isConnected: z.boolean(),
  isReady: z.boolean(),
  isActive: z.boolean(),
});

/**
 * One recorded event. `kind` is declared first and the fields follow the order replay's shape
 * check has always reported them, so a corrupt entry fails on the same field it used to.
 */
const ActionLogEntrySchema = z.strictObject({
  kind: z.enum(["action", "transition", "enter", "timeout", "roster-change"]),
  t: z.number(),
  seq: z.number(),
  phase: z.string(),
  actionType: z.string().optional(),
  senderId: z.string().optional(),
  payload: z.unknown().optional(),
  rejected: z.boolean().optional(),
  redacted: z.boolean().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

/** The log header, in the order replay's shape check has always reported its fields. */
const ActionLogHeaderSchema = z.strictObject({
  game: z.string(),
  seed: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  version: z.string().optional(),
  protocolVersion: z.number().int().optional(),
  startedAt: z.number(),
});

/**
 * The wire shape of an {@link ActionLog}: strict objects, so a hand-edited log with unknown
 * fields is rejected as well. `replayLog` validates every log against this before reading it;
 * bundle and spectator code (#19) validates untrusted logs with it too.
 */
export const ActionLogSchema = z.strictObject({
  entries: z.array(ActionLogEntrySchema),
  header: ActionLogHeaderSchema,
  roster: z.array(RosterSeatSchema).optional(),
});

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
        protocolVersion: PROTOCOL_VERSION,
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
 * and must reject again. A rejection recorded with `redactPayload: true` (a middleware that refused
 * the action before the handler ran, like the text filter) is logged with `rejected: true` and
 * `redacted: true` and no `payload`; `replayLog` skips such entries. See "Action log and replay" in
 * the framework guide.
 */
export function actionLogMiddleware(): PhaseMiddleware<PhaseState, unknown, unknown> {
  return (ctx, next) => {
    const log = logOf(ctx);
    const event = ctx.event;
    // The seats when the game starts, in seat order — what replay pre-seats. The flags are
    // recorded too: replay restores them so its bench-on-start matches live's exactly. An
    // auto-started session has no START_GAME action, so a departure from the Lobby records it.
    const recordRoster = (): void => {
      if (log.roster === undefined) {
        log.roster = ctx.players().map((seat) => ({
          id: seat.id,
          isConnected: seat.isConnected,
          isReady: seat.isReady,
          isActive: seat.isActive,
        }));
      }
    };
    const entry: ActionLogEntry = {
      seq: log.entries.length + 1,
      t: ctx.now(),
      phase: ctx.phase,
      kind: event.kind,
    };
    if (event.kind === "action") {
      entry.actionType = event.actionType;
      entry.senderId = event.senderId;
      entry.payload = deepFreeze(structuredClone(event.payload));
      if (event.actionType === START_GAME) recordRoster();
    } else if (event.kind === "transition") {
      entry.from = event.from;
      entry.to = event.to;
      if (event.from === LOBBY_PHASE) recordRoster();
    }
    log.entries.push(entry);
    next();
    if (event.kind === "action" && ctx.rejectionCount > 0) {
      entry.rejected = true;
      if (ctx.redactedRejectionCount > 0) {
        // The rejection asked for redaction: the payload never lands in the log.
        delete entry.payload;
        entry.redacted = true;
      }
    }
  };
}
