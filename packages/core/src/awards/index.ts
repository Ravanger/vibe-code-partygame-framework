import type { ActionLog, ActionLogEntry, RosterSeat } from "../actionLog.js";

/**
 * A game-declared award: a pure reducer over the session's action-log entries. Awards are data,
 * not code paths — a game lists its awards and hands them to {@link computeAwards}. An award that
 * needs game state at each step cannot be expressed here; the documented escape hatch is for the
 * game to feed accumulators into its private state itself and have its reducer ignore the log.
 */
export interface AwardDefinition {
  /** Stable id of the award, echoed in the result. */
  id: string;
  /** Display title, echoed in the result. */
  title: string;
  /**
   * Scores every player from the log: playerId to score. Receives only accepted entries (rejected
   * ones are filtered out before any reducer runs) and the recorded roster (an empty array when
   * the session never started). Return an empty map when the award has no data — it then has no
   * winner. Never mutate the entries or their payloads; they belong to the log.
   */
  reduce(
    entries: readonly ActionLogEntry[],
    roster: readonly RosterSeat[],
  ): ReadonlyMap<string, number>;
  /** Whether a higher score wins; default `true` (a "fastest" award passes `false`). */
  higherIsBetter?: boolean;
}

/** The computed result of one {@link AwardDefinition}. */
export interface AwardResult {
  /** The definition's id. */
  id: string;
  /** The definition's title. */
  title: string;
  /** The reducer's score map, playerId to score. */
  scores: ReadonlyMap<string, number>;
  /**
   * The winning playerIds — the best score(s), ties shared — in the score map's iteration order.
   * Empty when the award has no data.
   */
  winners: readonly string[];
}

/**
 * Computes every declared award from a session's action log (read with `getActionLog(priv)`).
 * Rejected entries (`rejected: true`) are filtered out before any reducer runs: they changed
 * nothing, so they score nothing. Results follow the declarations' order.
 */
export function computeAwards(log: ActionLog, defs: readonly AwardDefinition[]): AwardResult[] {
  const entries = log.entries.filter((entry) => entry.rejected !== true);
  const roster = log.roster ?? [];
  return defs.map((def) => {
    const scores = def.reduce(entries, roster);
    const values = [...scores.values()];
    const best =
      values.length === 0
        ? undefined
        : def.higherIsBetter !== false
          ? Math.max(...values)
          : Math.min(...values);
    const winners =
      best === undefined
        ? []
        : [...scores.entries()].filter(([, score]) => score === best).map(([playerId]) => playerId);
    return { id: def.id, title: def.title, scores, winners };
  });
}
