import { LOBBY_PHASE } from "@partygame/shared";
import type { ActionLog, ActionLogEntry } from "./actionLog.js";
import type { GameDefinition, PhaseDefinition, PhaseState } from "./runtime/index.js";
import { TestTable } from "./testing/TestTable.js";
import { required } from "./utils.js";

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
  /** Overrides the seed in the log header; defaults to the recorded seed. */
  seed?: number;
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
 * Builds a `TestTable` with the log's seed (or `init.seed`) and start time, then walks the entries
 * in order: transitions and enters are consequences of the step that started them and are skipped;
 * every other entry advances the clock to its `t`, re-dispatches the action (if any) and produces
 * one snapshot. Logged timeouts are authoritative: when the replayed runtime enters a timed phase,
 * its timer is made to expire at the time recorded in the log — a live room's tick-quantized clock
 * can fire a few ms early or late relative to enter + duration — so `phaseEndsAt` in the snapshots
 * reflects that time. The recorded roster (the seats at START_GAME, host first) is pre-seated and its
 * ids are mapped positionally to p1..pN so actions re-dispatch against the matching seats; a log
 * without a roster requires `init.players` instead. Roster changes during the Lobby are skipped —
 * the table is already seated; a mid-game roster change throws, because v1 does not replay it.
 * Entries must be time-ordered; a backwards clock throws. A re-dispatch that rejects where the log
 * says the action was accepted throws, and one that accepts where the log marks the entry
 * `rejected: true` throws as well — both directions of mismatch mean the log is not what this
 * definition produces. Each step's logged transitions and enters are asserted against the replayed
 * runtime — a log that contradicts what this definition actually does throws, naming the mismatch.
 * See "Action log and replay" in the framework guide.
 */
export function replayLog<TState extends PhaseState, TPrivate, TOptions>(
  definition: GameDefinition<TState, TPrivate, TOptions>,
  log: ActionLog,
  init: ReplayInit<TState, TOptions>,
): ReplayResult<TState> {
  if (definition.name !== log.header.game) {
    throw new Error(
      `replayLog: log was recorded for game "${log.header.game}", not "${definition.name}"`,
    );
  }
  let seatCount: number;
  let toSeat: Map<string, string> | undefined;
  const roster = log.roster;
  if (roster !== undefined) {
    seatCount = roster.length;
    // The live host is the first seat and FakeHost makes the first seated player the host, so a
    // positional map preserves both identity and order.
    toSeat = new Map(roster.map((id, index) => [id, `p${index + 1}`] as const));
  } else {
    if (init.players === undefined) {
      throw new Error("replayLog: the log has no recorded roster; pass init.players");
    }
    seatCount = init.players;
  }
  const table = new TestTable({
    definition: authoritativeDurations(definition, pairTimeouts(log.entries)),
    state: init.state,
    options: init.options,
    players: seatCount,
    seed: init.seed ?? log.header.seed,
    startTime: log.header.startedAt,
  });
  const states: TState[] = [clone(table.state)];
  for (let i = 0; i < log.entries.length; ++i) {
    const entry = required(log.entries[i], "log entry");
    // Transition and enter entries are consequences of the step that caused them; each step asserts
    // its own consequence run below.
    if (entry.kind === "transition" || entry.kind === "enter") continue;
    if (entry.t < table.host.time) {
      throw new Error(
        `replayLog: entry ${entry.seq} has t=${entry.t} before the current clock ${table.host.time}; log entries must be time-ordered`,
      );
    }
    if (entry.kind === "roster-change" && entry.phase !== LOBBY_PHASE) {
      throw new Error(
        `replayLog: mid-game roster changes are not replayable in v1 (entry ${entry.seq} in phase "${entry.phase}")`,
      );
    }
    const prePhase = table.phase;
    table.tick(entry.t - table.host.time);
    if (entry.kind === "action") {
      const senderId = entry.senderId ?? "";
      const error = table.act(
        toSeat?.get(senderId) ?? senderId,
        entry.actionType ?? "",
        (entry.payload ?? {}) as Record<string, unknown>,
      );
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
    if (table.phase !== expected) {
      throw new Error(
        `replayLog: after entry ${entry.seq} the log expects phase "${expected}" but replay is in phase "${table.phase}"`,
      );
    }
    states.push(clone(table.state));
  }
  return { states };
}
