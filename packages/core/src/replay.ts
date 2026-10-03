import { LOBBY_PHASE } from "@partygame/shared";
import type { ActionLog } from "./actionLog.js";
import type { GameDefinition, PhaseState } from "./runtime/index.js";
import { TestTable } from "./testing/TestTable.js";

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
 * Re-drives a fresh runtime from an {@link ActionLog} and returns deep-cloned state snapshots.
 * Builds a `TestTable` with the log's seed (or `init.seed`) and start time, then walks the entries
 * in order: transitions and enters are consequences of the step that started them and are skipped;
 * every other entry advances the clock to its `t`, re-dispatches the action (if any) and produces
 * one snapshot. The recorded roster (the seats at START_GAME, host first) is pre-seated and its
 * ids are mapped positionally to p1..pN so actions re-dispatch against the matching seats; a log
 * without a roster requires `init.players` instead. Roster changes during the Lobby are skipped —
 * the table is already seated; a mid-game roster change throws, because v1 does not replay it.
 * Entries must be time-ordered; a backwards clock throws. Rejected re-dispatches throw as well: a
 * valid log only contains actions the live runtime accepted from seats in the recorded roster.
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
    definition,
    state: init.state,
    options: init.options,
    players: seatCount,
    seed: init.seed ?? log.header.seed,
    startTime: log.header.startedAt,
  });
  const states: TState[] = [clone(table.state)];
  for (const entry of log.entries) {
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
    table.tick(entry.t - table.host.time);
    if (entry.kind === "action") {
      const senderId = entry.senderId ?? "";
      const error = table.act(
        toSeat?.get(senderId) ?? senderId,
        entry.actionType ?? "",
        (entry.payload ?? {}) as Record<string, unknown>,
      );
      if (error !== undefined) {
        throw new Error(
          `replayLog: re-dispatched action ${entry.actionType} was rejected (${error.code}: ${error.message})`,
        );
      }
    }
    states.push(clone(table.state));
  }
  return { states };
}
