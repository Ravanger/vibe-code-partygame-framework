import { LOBBY_PHASE, type ServerError } from "@partygame/shared";
import { type ActionLog, type ActionLogEntry, ActionLogSchema } from "../actionLog.js";
import {
  type GameDefinition,
  GameRuntime,
  type PhaseDefinition,
  type PhaseState,
  type PlayerInfo,
} from "../runtime/index.js";
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
    throw new Error(
      `replayLog: entry ${entry.seq} re-ran into a failed run (${String(cause)}); logs containing a failed run are not replayable in v1`,
      { cause },
    );
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The kinds a recorded entry may carry — the set the replay walk dispatches on. */
const ENTRY_KINDS = ["action", "transition", "enter", "timeout", "roster-change"] as const;

/** The fields of a schema issue this mapper reads. */
interface ShapeIssue {
  code: string;
  path: readonly PropertyKey[];
}

/** The type text for an entry field in a shape error, mirroring the messages replay has always thrown. */
function entryFieldType(field: string): string {
  switch (field) {
    case "kind":
      return `one of ${ENTRY_KINDS.join(", ")}`;
    case "t":
    case "seq":
      return "a number";
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

/** Describes the first {@link ActionLogSchema} issue as the named `replayLog:` message replay has always thrown. */
function shapeMessage(issues: readonly ShapeIssue[], log: unknown): string {
  const issue = required(issues[0], "shape issue");
  const [section, index, field] = issue.path;
  if (section === "entries") {
    if (typeof index !== "number") return "log.entries must be an array";
    // A path of ["entries", i] means the schema saw an array there, so this cannot miss.
    const entry = (log as { entries: readonly unknown[] }).entries[index];
    if (field === undefined) {
      return issue.code === "unrecognized_keys"
        ? `malformed log entry ${JSON.stringify(entry)}: has unrecognized fields`
        : `malformed log entry ${JSON.stringify(entry)}: must be an object`;
    }
    return `malformed log entry ${JSON.stringify(entry)}: "${String(field)}" must be ${entryFieldType(String(field))}`;
  }
  if (section === "header") {
    if (index === undefined) {
      return issue.code === "unrecognized_keys"
        ? "log.header has unrecognized fields"
        : "log.header must be an object";
    }
    return `log.header.${String(index)} must be ${headerFieldType(String(index))}`;
  }
  if (section === "roster") {
    if (typeof index !== "number") return "log.roster must be an array";
    // A path of ["roster", i] means the schema saw an array there, so this cannot miss.
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

/**
 * Validates the log's shape before `replayLog` reads it: a hand-edited or corrupt log must fail
 * with a named `replayLog:` error, never a raw `TypeError` partway through the walk. The shape is
 * {@link ActionLogSchema}; its declaration order mirrors the check replay has always reported, so
 * the messages are unchanged.
 */
function assertLogShape(log: ActionLog): void {
  const parsed = ActionLogSchema.safeParse(log);
  if (parsed.success) return;
  throw new Error(`replayLog: ${shapeMessage(parsed.error.issues, log)}`);
}

/**
 * Pairs each logged enter with the timeout that closed it. Per phase, one slot per enter in log
 * order, filled with the timeout entry's `t` when the phase timed out before its next enter;
 * `undefined` when the phase left early. A valid log pairs 1:1 — a timeout without an open enter
 * (a malformed log) is ignored.
 */
function pairTimeouts(entries: ActionLogEntry[]): Map<string, (number | undefined)[]> {
  const pairs = new Map<string, (number | undefined)[]>();
  const open = new Map<string, { list: (number | undefined)[]; index: number }>();
  for (const entry of entries) {
    if (entry.kind === "enter") {
      // Re-enters (including a timeout that re-enters its own phase) append to the existing list.
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
 * A live room's phase timers run on Colyseus's tick-quantized clock (~17 ms grid), so a logged
 * timeout can precede or follow the nominal enter + duration deadline; the log is authoritative.
 * Enters without a logged timeout keep the original duration (their timer is cancelled on the
 * early exit, exactly as live). When the original duration is a function it is still called on
 * every enter — its value is only discarded when a recorded timeout is authoritative — so a
 * duration that draws from `ctx.rng()` consumes the same RNG draws, in the same order, as live.
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
        // Call the original even when the recorded timeout is authoritative: a function duration
        // that draws the RNG must consume the same draws, in the same order, as live.
        const base = typeof original === "function" ? original(ctx) : original;
        return at !== undefined ? at - ctx.now() : base;
      },
    };
  }
  return { ...definition, phases };
}

/**
 * Re-drives a fresh runtime from an {@link ActionLog} and returns deep-cloned state snapshots.
 * The definition's `name` and `version` must match the log's header: a different game or version
 * throws, as does a log with no recorded version (one predating versioning).
 * The log must start with the construction-time Lobby enter (seq 1) — every recorded session does,
 * because the middleware creates the log on its first event — and a different first entry throws.
 * Builds a {@link ReplayHost} with the log's seed (or `init.seed`) and start time and drives a
 * fresh `GameRuntime` on it, then walks the entries in order: transitions and enters are
 * consequences of the step that started them and are skipped; every other entry advances the clock
 * to its `t`, re-dispatches the action (if any) and produces one snapshot. Logged timeouts are
 * authoritative: when the replayed runtime enters a timed phase, its timer is made to expire at
 * the time recorded in the log — a live room's tick-quantized clock can fire a few ms early or
 * late relative to enter + duration — so `phaseEndsAt` in the snapshots reflects that time. The
 * recorded roster (the seats at START_GAME, host first) is pre-seated with its recorded flags — so
 * the replayed bench-on-start and `activePlayers()` reads match live — and its ids are mapped
 * positionally to p1..pN so actions re-dispatch against the matching seats; a log without a roster
 * requires `init.players` instead. Roster changes during the Lobby are skipped — the table is
 * already seated — except the one an auto-started session records right before its start
 * transition, which re-runs the lobby hook against the seated table so the replay performs the
 * same start at the same time; a mid-game roster change throws, because v1 does not replay it.
 * A step whose re-run throws (the live run failed and the failure policy returned the room to the Lobby)
 * throws a `replayLog:` error saying logs with a failed run are not replayable in v1.
 * Entries must be time-ordered; a backwards clock throws. A re-dispatch that rejects where the log
 * says the action was accepted throws, and one that accepts where the log marks the entry
 * `rejected: true` throws as well — both directions of mismatch mean the log is not what this
 * definition produces. Redacted entries (`redacted: true`) are skipped: they were refused before the
 * handler ran, so no payload was logged and no state or RNG changed — the clock still advances to
 * their `t` and they produce a snapshot like any other step. Each step's logged transitions and enters
 * are asserted against the replayed
 * runtime — a log that contradicts what this definition actually does throws, naming the mismatch.
 * The log's shape is validated up front against {@link ActionLogSchema} (strict objects: `entries`
 * an array of objects each with a known `kind`, numeric `t` and `seq` and a string `phase`;
 * `header` with a string `game`, four-number `seed` and number `startedAt`; roster entries carrying
 * `id` plus the seat flags; no unknown fields anywhere) — a malformed log throws a named error
 * before anything runs. See "Action log and replay" in the framework guide.
 */
export function replayLog<TState extends PhaseState, TPrivate, TOptions>(
  definition: GameDefinition<TState, TPrivate, TOptions>,
  log: ActionLog,
  init: ReplayInit<TState, TOptions>,
): ReplayResult<TState> {
  assertLogShape(log);
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
  // The middleware creates the log on its first event, and a runtime's first event is always the
  // construction-time Lobby enter — so any valid log starts with exactly that entry.
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
    // The live host is the first seat and ReplayHost makes the first seated player the host, so a
    // positional map preserves both identity and order.
    toSeat = new Map(roster.map((seat, index) => [seat.id, `p${index + 1}`] as const));
    // Restore the recorded flags so the replayed bench-on-start and activePlayers() reads match live.
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
  const runtime = new GameRuntime({
    definition: authoritativeDurations(definition, pairTimeouts(log.entries)),
    state: init.state,
    options: init.options,
    host,
  });
  const states: TState[] = [clone(init.state)];
  // An auto-started session records its start transition right after the roster change that
  // triggered it; those steps re-run the lobby hook against the already-seated table so the
  // replay performs the same start at the same time. Other lobby roster changes stay skipped.
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
    // Transition and enter entries are consequences of the step that caused them; each step asserts
    // its own consequence run below.
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
      host.advance(entry.t - host.time);
      if (settleSeqs.has(entry.seq)) runtime.rosterChanged();
      // A redacted entry was refused before the handler ran and its payload is not in the log:
      // re-dispatching it is impossible, and skipping it keeps state and RNG in step with live.
      if (entry.kind !== "action" || entry.redacted === true) return undefined;
      const senderId = entry.senderId ?? "";
      return runtime.dispatch(toSeat?.get(senderId) ?? senderId, {
        type: entry.actionType ?? "",
        ...((entry.payload ?? {}) as Record<string, unknown>),
      });
    });
    if (entry.kind === "action" && entry.redacted !== true) {
      if (entry.rejected === true) {
        // The live handler rejected: the re-dispatch must reject again. Re-running it also consumes
        // any RNG draws the handler made before rejecting, keeping the stream in step with live.
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
    // The transitions and enters that follow a step are its consequences: the replayed runtime must
    // have performed exactly what the log records, or the log is not what this definition produces.
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
