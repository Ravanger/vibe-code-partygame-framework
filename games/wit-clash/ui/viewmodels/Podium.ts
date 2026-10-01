import type { Scoreboard, ScoreRow } from "./Scoreboard.js";

export interface PodiumStep {
  rank: number;
  label: string;
  players: ScoreRow[];
}

const label = (rank: number): string => (rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd");

/** The top three places among seated players; players tied on a score share a step. */
export class Podium {
  constructor(private readonly scoreboard: Scoreboard) {}

  /** In display order: runner-up on the left, winner in the middle, third on the right. */
  get steps(): PodiumStep[] {
    const byRank = new Map<number, ScoreRow[]>();
    for (const row of this.scoreboard.rows) {
      if (!row.hasLeft && row.rank <= 3)
        byRank.set(row.rank, [...(byRank.get(row.rank) ?? []), row]);
    }
    const ordered = [...byRank.entries()]
      .sort(([a], [b]) => a - b)
      .map(([rank, players]) => ({ rank, label: label(rank), players }));
    const [first, second, third] = ordered;
    return [second, first, third].filter((step) => step !== undefined);
  }
}
