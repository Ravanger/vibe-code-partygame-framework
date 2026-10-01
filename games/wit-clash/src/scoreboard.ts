import { leaderboard } from "@partygame/core";
import type { MatchupAward } from "./scoring.js";

export interface ScoreRow {
  playerId: string;
  name: string;
  score: number;
  roundPoints: number;
  matchupsWon: number;
  hadClash: boolean;
  wonTieBreaker: boolean;
  hasLeft: boolean;
}

export interface ScoreboardInput {
  scores: Readonly<Record<string, number>>;
  /** This round's awards. */
  awards: readonly MatchupAward[];
  /** Winner of the final tie-breaker, or empty. */
  tieBreakerWinnerId: string;
  /** Players taking part now, whether or not they have scored. */
  activeIds: readonly string[];
  /** Everyone who took part in this game, seated or not. */
  participantIds: readonly string[];
  /** Names of players still seated. */
  seatedNames: ReadonlyMap<string, string>;
  /** Last known names, for players who have left. */
  rememberedNames: Readonly<Record<string, string>>;
}

/** Everyone who took part, seated players first and leavers below them, each group best first. Leavers keep their name and score. */
export function composeScoreboard(input: ScoreboardInput): ScoreRow[] {
  const ids = new Set([...input.activeIds, ...input.participantIds, ...Object.keys(input.scores)]);
  const totals: Record<string, number> = {};
  for (const id of ids) totals[id] = input.scores[id] ?? 0;
  const seated = (playerId: string): boolean => input.seatedNames.has(playerId);
  const ranked = leaderboard(totals);
  const ordered = [
    ...ranked.filter((r) => seated(r.playerId)),
    ...ranked.filter((r) => !seated(r.playerId)),
  ];
  return ordered.map(({ playerId, score }) => {
    const awards = input.awards.filter((a) => a.playerId === playerId);
    return {
      playerId,
      name: input.seatedNames.get(playerId) ?? input.rememberedNames[playerId] ?? "",
      score,
      roundPoints: awards.reduce((n, a) => n + a.total, 0),
      matchupsWon: awards.filter((a) => a.isWinner).length,
      hadClash: awards.some((a) => a.isClash),
      wonTieBreaker: playerId === input.tieBreakerWinnerId,
      hasLeft: !seated(playerId),
    };
  });
}
