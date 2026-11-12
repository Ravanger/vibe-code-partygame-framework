import { LOBBY_PHASE, PROTOCOL_VERSION, type ServerError } from "@partygame/shared";
import {
  ACTION_LOG_ENTRY_KINDS,
  type ActionLog,
  type ActionLogEntry,
  ActionLogSchema,
  MAX_ACTION_LOG_ENTRIES,
} from "../actionLog.js";
import {
  type GameContext,
  type GameDefinition,
  GameRuntime,
  type PhaseDefinition,
  type PhaseState,
  type PlayerInfo,
} from "../runtime/index.js";
import { TimerLimitError } from "../timers.js";
import { required, type Seed } from "../utils.js";
import { ReplayHost } from "./ReplayHost.js";

/** Starting values for {@link replayLog}. */
export interface ReplayInit<TState extends PhaseState, TOptions> {
  /** A fresh synced state, e.g. `new MyState()`. */
  state: TState;
  /** Already parsed room options. */
  options: TOptions;
  /**
   * Seats p1..pN to pre-seat (p1 is the host). Required only when the log has no recorded roster
   * (lobby-only sessions); a recorded roster wins and this value is ignored.
   */
  players?: number;
  /** Overrides the seed in the log header; defaults to the recorded seed. A number is expanded by `seedFromNumber`. */
  seed?: Seed | number;
}

/** The outcome of {@link replayLog}. */
export interface ReplayResult<TState extends PhaseState> {
  /**
   * `states[0]` is the fresh construction at `header.startedAt`, before any entry. Each following
   * element is the state after one more step: every logged action, timeout or (skipped) lobby
   * roster change starts a step; the transitions and enters that follow belong to the same step.
   */
  states: TState[];
}

/** Runs one replay step; a throw means the live run failed here too, which v1 cannot replay. */
function failedRunGuard(
  entry: ActionLogEntry,
  step: () => ServerError | undefined,
): ServerError | undefined {
  try {
    return step();
  } catch (cause) {
    // A budget breach is a verdict on the log itself; rethrow it as-is so its message stands.
    if (cause instanceof TimerLimitError) throw cause;
    throw new Error(
      `replayLog: entry ${entry.seq} re-ran into a failed run (${String(cause)}); logs containing a failed run are not replayable in v1`,
      { cause },
    );
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The fields of a schema issue this mapper reads. */
interface ShapeIssue {
  code: string;
  path: readonly PropertyKey[];
}

/** The integer range of each bounded numeric field, for out-of-range shape messages. */
const FIELD_RANGES: Record<string, readonly [number, number]> = {
  t: [0, Number.MAX_SAFE_INTEGER],
  seq: [1, Number.MAX_SAFE_INTEGER],
  startedAt: [0, Number.MAX_SAFE_INTEGER],
  ticks: [0, Number.MAX_SAFE_INTEGER],
};

/** The "must be" text for a field, naming its integer range when the issue is an out-of-range value. */
function mustBe(field: string, code: string, typeText: string): string {
  const range = FIELD_RANGES[field];
  if (range !== undefined && (code === "too_small" || code === "too_big")) {
    return `an integer between ${range[0]} and ${range[1]}`;
  }
  return typeText;
}

/** The type text for an entry field in a shape error. */
function entryFieldType(field: string): string {
  switch (field) {
    case "kind":
      return `one of ${ACTION_LOG_ENTRY_KINDS.join(", ")}`;
    case "t":
    case "seq":
    case "ticks":
      return "a number";
    case "payload":
      return "a plain object";
    case "rejected":
    case "redacted":
      return "a boolean";
    default:
      return "a string";
  }
}

/** The type text for a header field in a shape error. */
function headerFieldType(field: string): string {
  switch (field) {
    case "seed":
      return "an array of 4 numbers";
    case "startedAt":
      return "a number";
    default:
      return "a string";
  }
}

/** The type text for a roster field in a shape error. */
function rosterFieldType(field: string): string {
  switch (field) {
    case "id":
      return "a string";
    default:
      return "a boolean";
  }
}

/** Describes the first {@link ActionLogSchema} issue as a named `replayLog:` message. */
function shapeMessage(issues: readonly ShapeIssue[], log: unknown): string {
  const issue = required(issues[0], "shape issue");
  const [section, index, field] = issue.path;
  if (section === "entries") {
    if (typeof index !== "number") {
      return issue.code === "too_big"
        ? `log.entries has more than ${MAX_ACTION_LOG_ENTRIES} entries`
        : "log.entries must be an array";
    }
    // A path of ["entries", i] means the schema saw an array there, so this cannot miss.
    const entry = (log as { entries: readonly unknown[] }).entries[index];
    if (field === undefined) {
      return issue.code === "unrecognized_keys"
        ? `malformed log entry ${JSON.stringify(entry)}: has unrecognized fields`
        : `malformed log entry ${JSON.stringify(entry)}: must be an object`;
    }
    return `malformed log entry ${JSON.stringify(entry)}: "${String(field)}" must be ${mustBe(String(field), issue.code, entryFieldType(String(field)))}`;
  }
  if (section === "header") {
    if (index === undefined) {
      return issue.code === "unrecognized_keys"
        ? "log.header has unrecognized fields"
        : "log.header must be an object";
    }
    return `log.header.${String(index)} must be ${mustBe(String(index), issue.code, headerFieldType(String(index)))}`;
  }
  if (section === "roster") {
    if (typeof index !== "number") return "log.roster must be an array";
    const seat = (log as { roster: readonly unknown[] }).roster[index];
    if (field === undefined) {
      return issue.code === "unrecognized_keys"
        ? `malformed roster entry ${JSON.stringify(seat)}: has unrecognized fields`
        : `malformed roster entry ${JSON.stringify(seat)}: "id" must be a string`;
    }
    return `malformed roster entry ${JSON.stringify(seat)}: "${String(field)}" must be ${rosterFieldType(String(field))}`;
  }
  return issue.code === "unrecognized_keys"
    ? "log has unrecognized fields"
    : "log must be an object";
}

/** Validates the log's shape so a corrupt log fails with a named `replayLog:` error, never a raw `TypeError`. */
function assertLogShape(log: ActionLog): void {
  const parsed = ActionLogSchema.safeParse(log);
  if (parsed.success) return;
  throw new Error(`replayLog: ${shapeMessage(parsed.error.issues, log)}`);
}

/** Pairs each logged enter with the timeout that closed it; `undefined` when the phase left early. */
function pairTimeouts(entries: ActionLogEntry[]): Map<string, (number | undefined)[]> {
  const pairs = new Map<string, (number | undefined)[]>();
  const open = new Map<string, { list: (number | undefined)[]; index: number }>();
  for (const entry of entries) {
    if (entry.kind === "enter") {
      let list = pairs.get(entry.phase);
      if (list === undefined) {
        list = [];
        pairs.set(entry.phase, list);
      }
      open.set(entry.phase, { list, index: list.length });
      list.push(undefined);
    } else if (entry.kind === "timeout") {
      const slot = open.get(entry.phase);
      if (slot !== undefined) {
        slot.list[slot.index] = entry.t;
        open.delete(entry.phase);
      }
    }
  }
  return pairs;
}

/**
 * Replaces each timed phase's duration with one that expires at the log's recorded timeout time.
 * Enters without a logged timeout keep the original duration.
 */
function authoritativeDurations<TState extends PhaseState, TPrivate, TOptions>(
  definition: GameDefinition<TState, TPrivate, TOptions>,
  pairs: Map<string, (number | undefined)[]>,
): GameDefinition<TState, TPrivate, TOptions> {
  const phases: Record<string, PhaseDefinition<TState, TPrivate, TOptions>> = {};
  for (const [name, phase] of Object.entries(definition.phases)) {
    const list = pairs.get(name);
    if (list === undefined || phase.duration === undefined) {
      phases[name] = phase;
      continue;
    }
    const original = phase.duration;
    let next = 0;
    phases[name] = {
      ...phase,
      duration: (ctx) => {
        const at = list[next++];
        // Call the original even when overridden: a function duration may draw the RNG.
        const base = typeof original === "function" ? original(ctx) : original;
        return at !== undefined ? at - ctx.now() : base;
      },
    };
  }
  return { ...definition, phases };
}

/** The replay-side bookkeeping for one ticking phase's capped tick delivery (#246). */
interface CappedTicks<TState extends PhaseState, TPrivate, TOptions> {
  /** The most ticks the current entry allows; `undefined` until an entry with `ticks` sets it. */
  limit: number | undefined;
  /** Ticks applied since the last enter. */
  applied: number;
  /** Ticks that fired nominally but must wait for a later entry's cap, in fire order. */
  pending: { ctx: GameContext<TState, TPrivate, TOptions>; dtMs: number }[];
  /** The phase's original `onTick`. */
  onTick: (ctx: GameContext<TState, TPrivate, TOptions>, dtMs: number) => void;
}

/**
 * Caps each ticking phase's tick delivery at the count its log entries record (#246). A live host
 * delivers ticks up to one clock grid step late, so an action can be logged after a tick's nominal
 * deadline but before its delivery; firing every nominally due tick would then apply one the live
 * room had not. Every phase's `onEnter` resets all caps — mirroring `enter()`'s cancel of the
 * pending tick when a phase is left, which also discards ticks deferred for a phase that never
 * got to deliver them. A ticking phase's `onTick` applies inline while under its entry's cap and
 * defers beyond it, in fire order; the walk sets each cap's limit from the entry's recorded
 * `ticks` and pumps the deferred ticks before advancing the clock. Entries without `ticks` (legacy
 * logs) leave the caps unbounded and replay every nominally due tick, as before.
 */
function capTicks<TState extends PhaseState, TPrivate, TOptions>(
  definition: GameDefinition<TState, TPrivate, TOptions>,
): {
  definition: GameDefinition<TState, TPrivate, TOptions>;
  caps: Map<string, CappedTicks<TState, TPrivate, TOptions>>;
} {
  const caps = new Map<string, CappedTicks<TState, TPrivate, TOptions>>();
  const resetAll = (): void => {
    for (const cap of caps.values()) {
      cap.limit = undefined;
      cap.applied = 0;
      cap.pending.length = 0;
    }
  };
  const phases: Record<string, PhaseDefinition<TState, TPrivate, TOptions>> = {};
  for (const [name, phase] of Object.entries(definition.phases)) {
    const onEnter = phase.onEnter;
    const wrapped: PhaseDefinition<TState, TPrivate, TOptions> = {
      ...phase,
      // Reset before the original hook runs, like enter() clears the tick timer before onEnter.
      onEnter: (ctx) => {
        resetAll();
        onEnter?.(ctx);
      },
    };
    if (phase.onTick !== undefined) {
      const cap: CappedTicks<TState, TPrivate, TOptions> = {
        limit: undefined,
        applied: 0,
        pending: [],
        onTick: phase.onTick,
      };
      caps.set(name, cap);
      wrapped.onTick = (ctx, dtMs) => {
        // Deferred ticks must apply before any later one, so a non-empty queue defers too.
        if (cap.pending.length > 0 || (cap.limit !== undefined && cap.applied + 1 > cap.limit)) {
          cap.pending.push({ ctx, dtMs });
          return;
        }
        cap.applied += 1;
        cap.onTick(ctx, dtMs);
      };
    }
    phases[name] = wrapped;
  }
  return { definition: { ...definition, phases }, caps };
}

/**
 * Re-drives a fresh runtime from an {@link ActionLog} and returns deep-cloned state snapshots,
 * `states[0]` being the construction state. Throws a `replayLog:` error when the log's shape is
 * invalid, its game, version or protocol version differs from the definition's, it has no recorded
 * roster and `init.players` is missing, its entries are not time-ordered, a mid-game roster change
 * or a failed run is logged, a re-dispatch's accept/reject outcome contradicts the log, or the
 * replayed transitions and enters differ from the logged ones. While a ticking phase is active the
 * replay caps its tick delivery at the count each entry recorded (a live host delivers ticks up to
 * one clock grid step late), and timer firing is budgeted: one advance fires at most
 * {@link MAX_TIMER_FIRES_PER_ADVANCE} timers, the whole run at most {@link MAX_TIMER_FIRES_PER_REPLAY}.
 * See "Action log and replay" in the framework guide.
 */
export function replayLog<TState extends PhaseState, TPrivate, TOptions>(
  definition: GameDefinition<TState, TPrivate, TOptions>,
  log: ActionLog,
  init: ReplayInit<TState, TOptions>,
): ReplayResult<TState> {
  assertLogShape(log);
  // The schema allows an empty array (it cannot know a session always records at least the
  // construction-time Lobby enter); refuse it with a named error instead of an index miss.
  if (log.entries.length === 0) {
    throw new Error("replayLog: the log has no entries");
  }
  if (definition.name !== log.header.game) {
    throw new Error(
      `replayLog: log was recorded for game "${log.header.game}", not "${definition.name}"`,
    );
  }
  if (typeof log.header.version !== "string") {
    throw new Error("replayLog: log.header.version is missing; the log predates versioned logs");
  }
  if (log.header.version !== definition.version) {
    throw new Error(
      `replayLog: log was recorded for version "${log.header.version}", not "${definition.version}"`,
    );
  }
  if (typeof log.header.protocolVersion !== "number") {
    throw new Error(
      `replayLog: log.header.protocolVersion is missing (the log predates protocol versioning); expected ${PROTOCOL_VERSION}`,
    );
  }
  if (log.header.protocolVersion !== PROTOCOL_VERSION) {
    throw new Error(
      `replayLog: log was recorded with protocol version ${log.header.protocolVersion}, not ${PROTOCOL_VERSION}`,
    );
  }
  const first = required(log.entries[0], "first log entry");
  if (first.seq !== 1 || first.kind !== "enter" || first.phase !== LOBBY_PHASE) {
    const what = first.kind === "action" ? `action "${first.actionType}"` : `"${first.kind}" entry`;
    throw new Error(
      `replayLog: the first log entry must be the construction-time Lobby enter (got ${what} in phase "${first.phase}", seq ${first.seq})`,
    );
  }
  let seatCount: number;
  let toSeat: Map<string, string> | undefined;
  let seats: Partial<PlayerInfo>[] | undefined;
  const roster = log.roster;
  if (roster !== undefined) {
    seatCount = roster.length;
    toSeat = new Map(roster.map((seat, index) => [seat.id, `p${index + 1}`] as const));
    seats = roster.map(({ isConnected, isReady, isActive }) => ({
      isConnected,
      isReady,
      isActive,
    }));
  } else {
    if (init.players === undefined) {
      throw new Error("replayLog: the log has no recorded roster; pass init.players");
    }
    seatCount = init.players;
  }
  const host = new ReplayHost(init.seed ?? log.header.seed);
  for (let i = 0; i < seatCount; ++i) host.seat(`p${i + 1}`, seats?.[i] ?? {});
  host.time = log.header.startedAt;
  const { definition: cappedDefinition, caps } = capTicks(definition);
  const runtime = new GameRuntime({
    definition: authoritativeDurations(cappedDefinition, pairTimeouts(log.entries)),
    state: init.state,
    options: init.options,
    host,
  });
  const states: TState[] = [clone(init.state)];
  // An auto-started session's start follows its roster change; re-run the lobby hook for those steps only.
  const settleSeqs = new Set<number>();
  for (let i = 0; i + 1 < log.entries.length; ++i) {
    const entry = required(log.entries[i], "log entry");
    if (
      entry.kind === "roster-change" &&
      required(log.entries[i + 1], "log entry").kind === "transition"
    ) {
      settleSeqs.add(entry.seq);
    }
  }
  for (let i = 0; i < log.entries.length; ++i) {
    const entry = required(log.entries[i], "log entry");
    if (entry.kind === "transition" || entry.kind === "enter") continue;
    if (entry.t < host.time) {
      throw new Error(
        `replayLog: entry ${entry.seq} has t=${entry.t} before the current clock ${host.time}; log entries must be time-ordered`,
      );
    }
    if (entry.kind === "roster-change" && entry.phase !== LOBBY_PHASE) {
      throw new Error(
        `replayLog: mid-game roster changes are not replayable in v1 (entry ${entry.seq} in phase "${entry.phase}")`,
      );
    }
    const prePhase = init.state.phase;
    const error = failedRunGuard(entry, () => {
      // The entry's recorded tick count is authoritative for its phase: cap the delivery at it and
      // apply what earlier entries deferred, before the clock advances past this entry's time.
      // Legacy entries carry no `ticks`, leaving the cap unbounded (the old behavior).
      const tickCap = caps.get(entry.phase);
      if (tickCap !== undefined && entry.ticks !== undefined) {
        const limit = entry.ticks;
        tickCap.limit = limit;
        runtime.runStep(() => {
          while (tickCap.pending.length > 0 && tickCap.applied < limit) {
            const item = required(tickCap.pending.shift(), "pending tick");
            tickCap.applied += 1;
            tickCap.onTick(item.ctx, item.dtMs);
          }
        });
      }
      host.advance(entry.t - host.time);
      if (settleSeqs.has(entry.seq)) runtime.rosterChanged();
      // Redacted entries carry no payload; skipping keeps state and RNG in step with live.
      if (entry.kind !== "action" || entry.redacted === true) return undefined;
      const senderId = entry.senderId ?? "";
      const seat = toSeat?.get(senderId);
      const rawAction = {
        type: entry.actionType ?? "",
        ...((entry.payload ?? {}) as Record<string, unknown>),
      };
      if (seat !== undefined) return runtime.dispatch(seat, rawAction);
      if (toSeat === undefined) return runtime.dispatch(senderId, rawAction);
      return runtime.dispatchAudience(senderId, rawAction);
    });
    if (entry.kind === "action" && entry.redacted !== true) {
      if (entry.rejected === true) {
        // Re-running also consumes the RNG draws the handler made before rejecting.
        if (error === undefined) {
          throw new Error(
            `replayLog: entry ${entry.seq} is logged as rejected, but the re-dispatch of action ${entry.actionType} was accepted`,
          );
        }
      } else if (error !== undefined) {
        throw new Error(
          `replayLog: re-dispatched action ${entry.actionType} was rejected (${error.code}: ${error.message})`,
        );
      }
    }
    let expected = prePhase;
    for (let j = i + 1; j < log.entries.length; ++j) {
      const consequence = required(log.entries[j], "log entry");
      if (consequence.kind !== "transition" && consequence.kind !== "enter") break;
      if (consequence.kind === "transition") {
        const to = required(consequence.to, "transition target");
        if (consequence.from !== expected) {
          throw new Error(
            `replayLog: entry ${consequence.seq} says transition "${consequence.from}" -> "${to}" but replay was in phase "${expected}"`,
          );
        }
        expected = to;
      } else if (consequence.phase !== expected) {
        throw new Error(
          `replayLog: entry ${consequence.seq} says enter "${consequence.phase}" but the log's transition leads to "${expected}"`,
        );
      }
    }
    if (init.state.phase !== expected) {
      throw new Error(
        `replayLog: after entry ${entry.seq} the log expects phase "${expected}" but replay is in phase "${init.state.phase}"`,
      );
    }
    states.push(clone(init.state));
  }
  return { states };
}
