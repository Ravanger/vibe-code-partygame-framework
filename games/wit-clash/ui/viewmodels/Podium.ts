import type { Scoreboard, ScoreRow } from "./Scoreboard.js";

export interface PodiumStep {
  rank: number;
  tier: number;
  label: string;
  players: ScoreRow[];
}

const tierLabel = (tier: number): string => (tier === 1 ? "1st" : tier === 2 ? "2nd" : "3rd");

/** The top three score tiers among seated players; tied players share a step and the next tier takes the next step; step labels name the tier, not the competition rank. */
export class Podium {
  constructor(private readonly scoreboard: Scoreboard) {}

  /** In display order: second tier on the left, winners in the middle, third tier on the right. */
  get steps(): PodiumStep[] {
    const byRank = new Map<number, ScoreRow[]>();
    for (const row of this.scoreboard.rows) {
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
}
