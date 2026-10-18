import { ACTION } from "../../src/actionNames.js";
import type { BluffManager } from "../manager.js";

export interface ScoreRow {
  playerId: string;
  name: string;
  score: number;
  hasLeft: boolean;
}

/** The final scoreboard, the winner line and the host's play-again button. */
export class ResultsViewModel {
  constructor(private readonly manager: BluffManager) {}

  get isHost(): boolean {
    return this.manager.isHost;
  }

  /** Seated players first, highest score first — as the server wrote it. */
  get rows(): ScoreRow[] {
    const state = this.manager.state;
    if (state === undefined) return [];
    return [...state.scoreboard].map((entry) => ({
      playerId: entry.playerId,
      name: entry.name,
      score: entry.score,
      hasLeft: entry.hasLeft,
    }));
  }

  get headline(): string {
    const rows = this.rows;
    const [leader] = rows;
    if (leader === undefined || leader.score <= 0) return "Nobody scored.";
    const tied = rows.filter((row) => row.score === leader.score).length > 1;
    if (tied) return "It's a tie!";
    return `${leader.name} wins with ${leader.score} points!`;
  }

  async playAgain(): Promise<void> {
    await this.manager.sendAction(ACTION.PLAY_AGAIN, {});
  }
}
