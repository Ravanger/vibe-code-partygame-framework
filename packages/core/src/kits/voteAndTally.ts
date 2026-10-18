/**
 * Votes per target, counting only the given voters. `votes` maps voter to target.
 *
 * @experimental Phase kit API; may change before 1.0.
 */
export function tallyVotes(
  voterIds: readonly string[],
  votes: ReadonlyMap<string, string>,
): Map<string, number> {
  const tally = new Map<string, number>();
  for (const voterId of voterIds) {
    const target = votes.get(voterId);
    if (target !== undefined) tally.set(target, (tally.get(target) ?? 0) + 1);
  }
  return tally;
}

/**
 * True when there is at least one voter and every one of them has voted.
 *
 * @experimental Phase kit API; may change before 1.0.
 */
export function allHaveVoted(
  voterIds: readonly string[],
  votes: ReadonlyMap<string, string>,
): boolean {
  return voterIds.length > 0 && voterIds.every((id) => votes.has(id));
}

/**
 * How many of the given voters have voted.
 *
 * @experimental Phase kit API; may change before 1.0.
 */
export function countVoted(
  voterIds: readonly string[],
  votes: ReadonlyMap<string, string>,
): number {
  return voterIds.filter((id) => votes.has(id)).length;
}

/**
 * The given players who are not in `excludedIds`; an empty exclusion list allows self-vote.
 *
 * @experimental Phase kit API; may change before 1.0.
 */
export function eligibleVoters(
  activeIds: readonly string[],
  excludedIds: readonly string[],
): string[] {
  const excluded = new Set(excludedIds);
  return activeIds.filter((id) => !excluded.has(id));
}

/**
 * The highest count and every id that shares it, in map order; a tie shows up as `ids.length > 1`. `top` is `-Infinity` when `counts` is empty.
 *
 * @experimental Phase kit API; may change before 1.0.
 */
export function leaders(counts: ReadonlyMap<string, number>): { top: number; ids: string[] } {
  const top = Math.max(...counts.values());
  return { top, ids: [...counts].filter(([, count]) => count === top).map(([id]) => id) };
}
