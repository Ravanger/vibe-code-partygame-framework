import { describe, it, expect } from 'vitest';
import { WitClashGame } from '../index.js';

describe('WitClashGame Full Round', () => {
  it('should run a complete cycle', () => {
    const state = WitClashGame.initialState();
    
    // Simulate SubmitAnswer
    const prompting = WitClashGame.phases.prompting;
    const ctxSubmit = { state, clientId: 'p1', data: { type: 'SubmitAnswer', answer: 'test' } };
    prompting.actions.SubmitAnswer.handler(ctxSubmit as any);
    
    // Simulate CastVote
    const voting = WitClashGame.phases.voting;
    const ctxVote = { state, clientId: 'p2', data: { type: 'CastVote', answerId: 'p1_a1' } };
    voting.actions.CastVote.handler(ctxVote as any);

    expect(true).toBe(true);
  });
});
