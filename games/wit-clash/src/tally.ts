/** Votes per target, counting only the given voters. `votes` maps voter to target. */
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

/** True when there is at least one voter and every one of them has voted. */
export function allHaveVoted(
  voterIds: readonly string[],
  votes: ReadonlyMap<string, string>,
): boolean {
  return voterIds.length > 0 && voterIds.every((id) => votes.has(id));
}

export function countVoted(
  voterIds: readonly string[],
  votes: ReadonlyMap<string, string>,
): number {
  return voterIds.filter((id) => votes.has(id)).length;
}
