import type { Matchup } from "../../src/state.js";
import type { WitClashManager } from "../manager.js";

export interface RevealedAnswer {
  id: string;
  text: string;
  votes: number;
  authorName: string;
  isWinner: boolean;
  isMine: boolean;
}

export interface RevealedMatchup {
  promptText: string;
  isForfeit: boolean;
  isClash: boolean;
  answers: RevealedAnswer[];
}

/** Revealed matchups as the server published them: who won, who wrote what, which was a clash. */
export class MatchupRecap {
  constructor(private readonly manager: WitClashManager) {}

  get active(): RevealedMatchup | undefined {
    const state = this.manager.state;
    const matchup = state?.matchups[state.activeMatchupIndex];
    return matchup?.isRevealed ? this.describe(matchup) : undefined;
  }

  get all(): RevealedMatchup[] {
    return [...(this.manager.state?.matchups ?? [])]
      .filter((matchup) => matchup.isRevealed)
      .map((matchup) => this.describe(matchup));
  }

  describe(matchup: Matchup): RevealedMatchup {
    return {
      promptText: matchup.promptText,
      isForfeit: matchup.isForfeit,
      isClash: matchup.isClash,
      answers: [...matchup.answers].map((a) => ({
        id: a.id,
        text: a.text,
        votes: a.votes,
        authorName: a.authorName,
        isWinner: a.isWinner,
        isMine: a.authorId === this.manager.playerId,
      })),
    };
  }
}
