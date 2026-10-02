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

export interface PodiumStep<T> {
  rank: number;
  tier: number;
  label: string;
  players: T[];
}

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
