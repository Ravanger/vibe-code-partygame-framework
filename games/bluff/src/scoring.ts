export const GUESS_POINTS = 2;
export const FOOL_POINTS = 1;

/** One player's take from a single round of bluffing. */
export interface RoundAward {
  playerId: string;
  points: number;
  fooledCount: number;
  guessedTruth: boolean;
}

const awardFor = (awards: Map<string, RoundAward>, playerId: string): RoundAward => {
  let award = awards.get(playerId);
  if (award === undefined) {
    award = { playerId, points: 0, fooledCount: 0, guessedTruth: false };
    awards.set(playerId, award);
  }
  return award;
};

/**
 * Awards for one round of bluffing: each voter who picked the truth gets {@link GUESS_POINTS},
 * and a fake's author gets {@link FOOL_POINTS} per vote that landed on it. One entry per player
 * who earned points (a guesser and/or a fooled author), in first-encounter order, so the same
 * votes settle identically.
 */
export function settleRound(
  votes: ReadonlyMap<string, string>,
  truthOptionId: string,
  optionAuthor: ReadonlyMap<string, string>,
): RoundAward[] {
  const awards = new Map<string, RoundAward>();
  for (const [voterId, optionId] of votes) {
    if (optionId === truthOptionId) {
      const award = awardFor(awards, voterId);
      award.points += GUESS_POINTS;
      award.guessedTruth = true;
      continue;
    }
    const authorId = optionAuthor.get(optionId) ?? "";
    if (authorId === "") continue;
    const award = awardFor(awards, authorId);
    award.points += FOOL_POINTS;
    award.fooledCount += 1;
  }
  return [...awards.values()];
}
