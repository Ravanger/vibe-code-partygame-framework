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
