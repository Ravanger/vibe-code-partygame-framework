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

/** The middleware instance that created each log; a second instance must fail loudly. */
const owners = new WeakMap<object, symbol>();

/**
 * Thrown when a second `actionLogMiddleware()` instance records an event for a priv whose log
 * already exists: both instances would append to the same log, colliding `seq`s and breaking
 * replay silently. Register the middleware once per game.
 */
export class DuplicateActionLogMiddlewareError extends Error {
  constructor() {
    super(
      "actionLogMiddleware is registered more than once for one game; every event would be recorded twice",
    );
    this.name = "DuplicateActionLogMiddlewareError";
  }
}

/** The most entries one log may hold; `ActionLogSchema` rejects longer logs. */
export const MAX_ACTION_LOG_ENTRIES = 100_000;

/** Every kind of event an {@link ActionLogEntry} may record; the single source for the entry schema and the replay walk. */
export const ACTION_LOG_ENTRY_KINDS = [
  "action",
  "transition",
  "enter",
  "timeout",
  "roster-change",
] as const;

/** The kind of event an {@link ActionLogEntry} records. */
export type ActionLogEntryKind = (typeof ACTION_LOG_ENTRY_KINDS)[number];

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
  /**
   * Ticks fired since entry into the current phase, recorded on every entry kind while a ticking
   * phase (`onTick`) is active — absent otherwise. A live host delivers ticks up to one clock
   * grid step late, so an action can be logged after a tick's nominal deadline but before its
   * delivery; `replayLog` caps the replayed tick count at this value so such an action replays
   * with exactly the ticks the live room had applied (#246). Logs recorded before this field
   * carry no `ticks`; they replay every nominally due tick, as before.
   */
  ticks?: number;
}

/** Written on the first recorded event. */
export interface ActionLogHeader {
  /** Room RNG seed (sfc32); replay uses it to reseed the runtime. */
  seed: Seed;
  /** Definition name; `replayLog` refuses a log recorded for another game. */
  game: string;
  /**
   * The definition's version; `replayLog` refuses a log with a different or missing version.
   */
  version?: string;
  /**
   * The framework's `PROTOCOL_VERSION` at record time; `replayLog` refuses a log with a different or
   * missing one.
   */
  protocolVersion?: number;
  /** `ctx.now()` at the first entry (the construction-time Lobby enter). */
  startedAt: number;
}

/** The complete record of one room session. JSON-serializable. */
export interface ActionLog {
  header: ActionLogHeader;
  /**
   * The seats in seat order, captured once when START_GAME was dispatched. Replay pre-seats them
   * with the recorded flags and maps the ids positionally to p1..pN. Absent from lobby-only
   * sessions; `replayLog` then requires `init.players`.
   */
  roster?: RosterSeat[];
  entries: ActionLogEntry[];
}

/** One recorded seat: the id plus the flags replay restores when pre-seating. */
const RosterSeatSchema = z.strictObject({
  /** The seat's playerId (a client-generated UUID in real rooms). */
  id: z.string(),
  isConnected: z.boolean(),
  isReady: z.boolean(),
  isActive: z.boolean(),
});

/** One recorded seat at START_GAME time: the id plus the flags replay restores when pre-seating. */
export type RosterSeat = z.infer<typeof RosterSeatSchema>;

/** A non-negative safe integer — the bound every recorded timestamp obeys. */
const nonNegativeSafeInt = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

/** True for the plain-object payloads action entries carry (never an array, never a primitive). */
function isPlainObjectPayload(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** One recorded event. Field order decides which field a shape error names first; numeric fields are bounded and `payload` must be a plain object when present. */
const ActionLogEntrySchema = z.strictObject({
  kind: z.enum(ACTION_LOG_ENTRY_KINDS),
  t: nonNegativeSafeInt,
  seq: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  phase: z.string(),
  actionType: z.string().optional(),
  senderId: z.string().optional(),
  payload: z.unknown().refine(isPlainObjectPayload).optional(),
  rejected: z.boolean().optional(),
  redacted: z.boolean().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  ticks: nonNegativeSafeInt.optional(),
});

/** The log header. Field order decides which field a shape error names first. */
const ActionLogHeaderSchema = z.strictObject({
  game: z.string(),
  seed: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  version: z.string().optional(),
  protocolVersion: z.number().int().optional(),
  startedAt: nonNegativeSafeInt,
});

/** The wire shape of an {@link ActionLog}: strict objects, so unknown fields are rejected; bounded for untrusted input (`t`/`startedAt` non-negative safe integers, `seq` from 1, `entries` at most {@link MAX_ACTION_LOG_ENTRIES}, action `payload` a plain object). `replayLog` validates every log against it before reading. */
export const ActionLogSchema = z.strictObject({
  entries: z.array(ActionLogEntrySchema).max(MAX_ACTION_LOG_ENTRIES),
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

function logOf(ctx: MiddlewareContext<PhaseState, unknown, unknown>, instance: symbol): ActionLog {
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
    owners.set(priv, instance);
  } else if (owners.get(priv) !== instance) {
    throw new DuplicateActionLogMiddlewareError();
  }
  return log;
}

/**
 * Records every middleware-visible event (actions, transitions, enters, timeouts, roster changes)
 * into an append-only, JSON-serializable log kept outside `ctx.priv`; never touches `ctx.state`.
 * While a ticking phase (`onTick`) is active, every entry also carries `ticks` — the ticks fired since
 * the phase was entered — so replay can cap its tick delivery at the live count.
 * Actions rejected before the handler chain are not logged; one rejected by its handler is logged
 * with `rejected: true`, and a redacted rejection with `redacted: true` and no `payload`.
 * Register exactly one instance per game: a second instance recording for the same priv throws
 * {@link DuplicateActionLogMiddlewareError} instead of double-recording every event.
 * See "Action log and replay" in the framework guide.
 */
export function actionLogMiddleware(): PhaseMiddleware<PhaseState, unknown, unknown> {
  const instance = Symbol("actionLogMiddleware");
  return (ctx, next) => {
    const log = logOf(ctx, instance);
    const event = ctx.event;
    // An auto-started session has no START_GAME action, so a departure from the Lobby records the roster.
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
    // While a ticking phase is active, the live tick count so far: replay caps its tick delivery
    // at it (#246). Absent otherwise — legacy logs keep their old shape.
    if (ctx.ticks !== undefined) entry.ticks = ctx.ticks;
    log.entries.push(entry);
    next();
    if (event.kind === "action" && ctx.rejectionCount > 0) {
      entry.rejected = true;
      if (ctx.redactedRejectionCount > 0) {
        delete entry.payload;
        entry.redacted = true;
      }
    }
  };
}
