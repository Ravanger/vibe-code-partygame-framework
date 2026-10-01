import type { WitClashManager } from "../manager.js";

export interface ScoreRow {
  playerId: string;
  name: string;
  score: number;
  roundPoints: number;
  matchupsWon: number;
  hadClash: boolean;
  wonTieBreaker: boolean;
  hasLeft: boolean;
  rank: number;
  isMe: boolean;
}

interface ScoreboardEntryKey {
  score: number;
  hasLeft: boolean;
}

/** The scoreboard as the server wrote it, seated players first and leavers below them, tied scores sharing a rank within each group. */
export class Scoreboard {
  constructor(private readonly manager: WitClashManager) {}

  get rows(): ScoreRow[] {
    let rank = 0;
    let previous: ScoreboardEntryKey | undefined;
    return [...(this.manager.state?.scoreboard ?? [])].map((entry, index) => {
      if (previous?.score !== entry.score || previous.hasLeft !== entry.hasLeft) rank = index + 1;
      previous = { score: entry.score, hasLeft: entry.hasLeft };
      return {
        playerId: entry.playerId,
        name: entry.name,
        score: entry.score,
        roundPoints: entry.roundPoints,
        matchupsWon: entry.matchupsWon,
        hadClash: entry.hadClash,
        wonTieBreaker: entry.wonTieBreaker,
        hasLeft: entry.hasLeft,
        rank,
        isMe: entry.playerId === this.manager.playerId,
      };
    });
  }
}
