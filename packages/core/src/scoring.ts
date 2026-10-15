/** Add `points` to a player's score; the single mutation path for scores. Scores are keyed by playerId. */
export function awardPoints(
  scores: Record<string, number>,
  playerId: string,
  points: number,
): void {
  const current = Object.hasOwn(scores, playerId) ? (scores[playerId] as number) : 0;
  Object.defineProperty(scores, playerId, {
    value: current + points,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

/** Scores as a list, highest first; ties break by playerId in code-point order. */
export function leaderboard(
  scores: Record<string, number>,
): Array<{ playerId: string; score: number }> {
  return Object.entries(scores)
    .map(([playerId, score]) => ({ playerId, score }))
    .sort((a, b) => b.score - a.score || (a.playerId < b.playerId ? -1 : 1));
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
  for (const id of input.ids ?? []) awardPoints(totals, id, 0);
  for (const [id, score] of Object.entries(input.scores)) awardPoints(totals, id, score);
  const ranked = leaderboard(totals).map(({ playerId, score }) => ({
    playerId,
    name:
      input.seatedNames.get(playerId) ??
      (Object.hasOwn(input.rememberedNames, playerId)
        ? input.rememberedNames[playerId]
        : undefined) ??
      "",
    score,
    hasLeft: !input.seatedNames.has(playerId),
  }));
  return [...ranked.filter((r) => !r.hasLeft), ...ranked.filter((r) => r.hasLeft)];
}
