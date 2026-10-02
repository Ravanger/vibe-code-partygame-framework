import { rankRows } from "@partygame/game-ui";
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

/** The scoreboard as the server wrote it, seated players first and leavers below them, tied scores sharing a rank within each group. */
export class Scoreboard {
  constructor(private readonly manager: WitClashManager) {}

  get rows(): ScoreRow[] {
    return rankRows(
      [...(this.manager.state?.scoreboard ?? [])].map((entry) => ({
        playerId: entry.playerId,
        name: entry.name,
        score: entry.score,
        roundPoints: entry.roundPoints,
        matchupsWon: entry.matchupsWon,
        hadClash: entry.hadClash,
        wonTieBreaker: entry.wonTieBreaker,
        hasLeft: entry.hasLeft,
        isMe: entry.playerId === this.manager.playerId,
      })),
    );
  }
}
