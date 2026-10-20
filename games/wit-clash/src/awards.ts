import { getActionLog, required } from "@partygame/core";
import { type AwardDefinition, computeAwards } from "@partygame/core/awards";
import { ACTION } from "./actionNames.js";
import type { WitClashContext, WitClashPrivate } from "./private.js";
import { Award } from "./state.js";

/** "Fastest answer": the smallest t delta between a phase enter and one of the player's SUBMIT_ANSWERs. */
export const fastestAnswer: AwardDefinition = {
  id: "fastest-answer",
  title: "Fastest answer",
  higherIsBetter: false,
  reduce(entries) {
    const scores = new Map<string, number>();
    let windowStart: number | undefined;
    for (const entry of entries) {
      if (entry.kind === "enter") {
        windowStart = entry.t;
        continue;
      }
      if (
        entry.kind !== "action" ||
        entry.actionType !== ACTION.SUBMIT_ANSWER ||
        entry.senderId === undefined
      ) {
        continue;
      }
      if (windowStart === undefined) continue;
      const delta = entry.t - windowStart;
      const previous = scores.get(entry.senderId);
      if (previous === undefined || delta < previous) scores.set(entry.senderId, delta);
    }
    return scores;
  },
};

/**
 * "Most votes received": the escape hatch. The log records which answer each vote went to, but not
 * who wrote it, so the award reads the game's own whole-game accumulator instead of the log.
 */
export const mostVotesReceived = (priv: WitClashPrivate): AwardDefinition => ({
  id: "most-votes-received",
  title: "Most votes received",
  reduce() {
    const scores = new Map<string, number>();
    for (const record of priv.answerHistory) {
      scores.set(record.authorId, (scores.get(record.authorId) ?? 0) + record.votes);
    }
    return scores;
  },
});

export const formatMs = (ms: number): string =>
  ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;

export const votesDetail = (votes: number): string => `${votes} vote${votes === 1 ? "" : "s"}`;

/** Computes the declared awards from the session's log and writes them to `state.awards`. */
export function writeAwards(ctx: WitClashContext): void {
  const log = required(getActionLog(ctx.priv), "action log");
  const state = ctx.state;
  state.awards.clear();
  // Every award winner authored an answer, and the reveal already required their name to be remembered.
  const nameOf = (playerId: string): string => required(ctx.priv.names[playerId], "winner name");
  const ceremony: Array<{ def: AwardDefinition; detail: (score: number) => string }> = [
    { def: fastestAnswer, detail: formatMs },
    { def: mostVotesReceived(ctx.priv), detail: votesDetail },
  ];
  for (const { def, detail } of ceremony) {
    const result = required(computeAwards(log, [def])[0], "award result");
    if (result.winners.length === 0) continue;
    const winnerId = required(result.winners[0], "winner");
    const score = required(result.scores.get(winnerId), "winning score");
    const award = new Award();
    award.id = result.id;
    award.title = result.title;
    for (const name of result.winners.map(nameOf)) award.winnerNames.push(name);
    award.detail = detail(score);
    state.awards.push(award);
  }
}
