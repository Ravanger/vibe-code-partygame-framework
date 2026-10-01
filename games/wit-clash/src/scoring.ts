export interface ScorableAnswer {
  id: string;
  authorId: string;
  votes: number;
  isPlaceholder: boolean;
}

export interface MatchupAward {
  playerId: string;
  votePoints: number;
  bonusPoints: number;
  total: number;
  isWinner: boolean;
  isClash: boolean;
}

export const POINTS_PER_VOTE = 100;
export const WINNER_BONUS = 50;
export const CLASH_BONUS = 150;
export const CLASH_MIN_VOTERS = 2;

/**
 * Pure. Score one head-to-head matchup.
 * `eligibleVoterCount` is how many players were allowed to vote (never the authors).
 */
export function calculateMatchupAwards(
  answers: readonly ScorableAnswer[],
  eligibleVoterCount: number,
): MatchupAward[] {
  if (eligibleVoterCount === 0) return [];

  const real = answers.filter((a) => a.authorId);
  const castVotes = real.reduce((n, a) => n + a.votes, 0);
  const maxVotes = real.length ? Math.max(...real.map((a) => a.votes)) : 0;
  const leaders = real.filter((a) => a.votes === maxVotes && maxVotes > 0);

  return real.map((a) => {
    if (a.isPlaceholder) {
      return {
        playerId: a.authorId,
        votePoints: 0,
        bonusPoints: 0,
        total: 0,
        isWinner: false,
        isClash: false,
      };
    }
    const votePoints = a.votes * POINTS_PER_VOTE;
    const isWinner = leaders.length === 1 && leaders.some((l) => l.id === a.id);
    const isClash =
      isWinner &&
      a.votes === castVotes &&
      eligibleVoterCount >= CLASH_MIN_VOTERS &&
      a.votes === eligibleVoterCount;
    const bonusPoints = (isWinner ? WINNER_BONUS : 0) + (isClash ? CLASH_BONUS : 0);
    return {
      playerId: a.authorId,
      votePoints,
      bonusPoints,
      total: votePoints + bonusPoints,
      isWinner,
      isClash,
    };
  });
}

export function forfeitAward(playerId: string): MatchupAward {
  return {
    playerId,
    votePoints: 0,
    bonusPoints: WINNER_BONUS,
    total: WINNER_BONUS,
    isWinner: true,
    isClash: false,
  };
}

export function settleMatchup(
  answers: readonly ScorableAnswer[],
  isForfeit: boolean,
  eligibleVoterCount: number,
): MatchupAward[] {
  if (!isForfeit) return calculateMatchupAwards(answers, eligibleVoterCount);
  return answers.filter((a) => !a.isPlaceholder).map((a) => forfeitAward(a.authorId));
}
