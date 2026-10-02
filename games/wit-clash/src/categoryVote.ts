import { required } from "@partygame/core";

export interface TalliedOption {
  id: string;
  votes: number;
}

/** Plurality winner; joint leaders (including "nobody voted") are broken at random. */
export function resolveCategoryVote(
  options: readonly TalliedOption[],
  random: () => number,
): string {
  if (options.length === 0) {
    throw new Error("Cannot resolve category vote: no options provided");
  }
  const maxVotes = Math.max(...options.map((o) => o.votes));
  const leaders = options.filter((o) => o.votes === maxVotes);
  return required(leaders[Math.floor(random() * leaders.length)], "category leader").id;
}
