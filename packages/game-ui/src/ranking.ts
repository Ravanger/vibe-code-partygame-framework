/** Competition ranks (1, 1, 3) over rows already in display order; a new rank group starts where hasLeft changes. */
export function rankRows<T extends { score: number; hasLeft: boolean }>(
  rows: readonly T[],
): Array<T & { rank: number }> {
  let rank = 0;
  let previous: T | undefined;
  return rows.map((row, index) => {
    if (previous?.score !== row.score || previous.hasLeft !== row.hasLeft) rank = index + 1;
    previous = row;
    return { ...row, rank };
  });
}

/** The seated rows sharing the best seated score; empty when nobody is seated or the best seated score is 0. */
export function leaders<T extends { score: number; hasLeft: boolean }>(rows: readonly T[]): T[] {
  const seated = rows.filter((row) => !row.hasLeft);
  const [first] = seated;
  if (first === undefined || first.score <= 0) return [];
  return seated.filter((row) => row.score === first.score);
}

/** One podium step: the players sharing a rank, with their tier (1-3) and display label. */
export interface PodiumStep<T> {
  rank: number;
  tier: number;
  label: string;
  players: T[];
}

/** A scoreboard row as the podium and ranking helpers read it. */
export interface PodiumRow {
  playerId: string;
  name: string;
  score: number;
  rank: number;
  hasLeft: boolean;
  isMe: boolean;
}

const tierLabel = (tier: number): string => (tier === 1 ? "1st" : tier === 2 ? "2nd" : "3rd");

/** Top three rank groups among seated rows, tier 1-3 labelled "1st"/"2nd"/"3rd", in display order second, first, third. */
export function podiumSteps<T extends { rank: number; hasLeft: boolean }>(
  rows: readonly T[],
): PodiumStep<T>[] {
  const byRank = new Map<number, T[]>();
  for (const row of rows) {
    if (!row.hasLeft) byRank.set(row.rank, [...(byRank.get(row.rank) ?? []), row]);
  }
  const [first, second, third] = [...byRank.entries()]
    .slice(0, 3)
    .map(([rank, players], index) => ({
      rank,
      tier: index + 1,
      label: tierLabel(index + 1),
      players,
    }));
  return [second, first, third].filter((step) => step !== undefined);
}
