type CategoryOption = {
  id: string;
  votes: number;
};

export function resolveCategoryVote(
  options: readonly CategoryOption[],
  random: () => number,
): string {
  if (options.length === 0) {
    throw new Error("Cannot resolve category vote: no options provided");
  }

  const maxVotes = Math.max(...options.map((o) => o.votes));
  const leaders = options.filter((o) => o.votes === maxVotes);

  if (leaders.length === 1) {
    // biome-ignore lint/style/noNonNullAssertion: leaders guaranteed to have 1 element
    return leaders[0]!.id;
  }

  const idx = Math.floor(random() * leaders.length);
  // biome-ignore lint/style/noNonNullAssertion: idx guaranteed in bounds by random() < 1
  return leaders[idx]!.id;
}
