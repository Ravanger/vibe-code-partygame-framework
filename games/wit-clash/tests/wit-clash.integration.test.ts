import { describe, it, expect } from 'vitest';
import { WitClashGame } from '../index.js';

describe('WitClashGame Integration', () => {
  it('should handle SubmitAnswer action in prompting phase', () => {
    const prompting = WitClashGame.phases.prompting;
    const ctx = { state: WitClashGame.initialState(), clientId: 'p1', data: { type: 'SubmitAnswer', answer: 'test' } };
    
    // This should not throw if logic is correct
    expect(() => prompting.actions.SubmitAnswer.handler(ctx as any)).not.toThrow();
  });

  it('should handle CastVote action in voting phase', () => {
    const voting = WitClashGame.phases.voting;
    const ctx = { state: WitClashGame.initialState(), clientId: 'p1', data: { type: 'CastVote', answerId: 'a1' } };
    
    // This should not throw if logic is correct
    expect(() => voting.actions.CastVote.handler(ctx as any)).not.toThrow();
  });
});
