/** Add `points` to a player's score; the single mutation path for scores. Scores are keyed by playerId. */
export function awardPoints(
  scores: Record<string, number>,
  playerId: string,
  points: number,
): void {
  scores[playerId] = (scores[playerId] ?? 0) + points;
}

/** Scores as a list, highest first; ties break by playerId. */
export function leaderboard(
  scores: Record<string, number>,
): Array<{ playerId: string; score: number }> {
  return Object.entries(scores)
    .map(([playerId, score]) => ({ playerId, score }))
    .sort((a, b) => b.score - a.score || a.playerId.localeCompare(b.playerId));
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  score: number;
  hasLeft: boolean;
}

export interface LeaderboardInput {
  scores: Readonly<Record<string, number>>;
  seatedNames: ReadonlyMap<string, string>;
  rememberedNames: Readonly<Record<string, string>>;
  /** Players to list even without a score. */
  ids?: readonly string[];
}

/** Everyone in `ids` and `scores` (missing scores are 0), seated players first then leavers, each group best first; names from seatedNames, else rememberedNames, else "". */
export function composeLeaderboard(input: LeaderboardInput): LeaderboardEntry[] {
  const totals: Record<string, number> = {};
  for (const id of [...(input.ids ?? []), ...Object.keys(input.scores)]) {
    totals[id] = input.scores[id] ?? 0;
  }
  const ranked = leaderboard(totals).map(({ playerId, score }) => ({
    playerId,
    name: input.seatedNames.get(playerId) ?? input.rememberedNames[playerId] ?? "",
    score,
    hasLeft: !input.seatedNames.has(playerId),
  }));
  return [...ranked.filter((r) => !r.hasLeft), ...ranked.filter((r) => r.hasLeft)];
}
