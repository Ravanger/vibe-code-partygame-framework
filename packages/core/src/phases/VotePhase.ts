import type { PhaseHandler } from './types.js';
import type { GameAction } from '@partygame/shared';

export class VotePhase implements PhaseHandler {
  private votes: Record<string, number> = {};

  handleAction(player: string, action: GameAction) {
    if (action.type !== 'CastVote') {
      throw new Error('Invalid Action');
    }
    
    if (action.answerId.startsWith(player)) {
      throw new Error('Cannot vote for self');
    }

    this.votes[action.answerId] = (this.votes[action.answerId] || 0) + 1;
  }

  getVotes() {
    return this.votes;
  }

  computeVisibility() { return { phase: 'Voting' }; }
}
