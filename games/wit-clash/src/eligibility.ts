/** Who may vote on a matchup: the active players who did not write one of its answers. A forfeit has no vote. */
export function eligibleVoterIds(
  activeIds: readonly string[],
  authorIds: readonly string[],
  isForfeit: boolean,
): string[] {
  if (isForfeit) return [];
  const authors = new Set(authorIds);
  return activeIds.filter((id) => !authors.has(id));
}
