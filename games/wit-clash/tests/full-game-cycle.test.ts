import { describe, it, expect } from 'vitest';
import { WitClashGame, votePhase } from '../index.js';

describe('WitClash Full Game Cycle', () => {
  it('should complete a full round of Prompting -> Voting', () => {
    const state = WitClashGame.initialState();
    const { prompting, voting } = WitClashGame.phases;

    const p1Ctx = { state, clientId: 'p1', data: { type: 'SubmitAnswer', answer: 'Answer 1' } };
    const p2Ctx = { state, clientId: 'p2', data: { type: 'SubmitAnswer', answer: 'Answer 2' } };
    
    prompting.actions.SubmitAnswer.handler(p1Ctx as any);
    prompting.actions.SubmitAnswer.handler(p2Ctx as any);
    
    const v1Ctx = { state, clientId: 'p1', data: { type: 'CastVote', answerId: 'p2_a1' } };
    const v2Ctx = { state, clientId: 'p2', data: { type: 'CastVote', answerId: 'p1_a1' } };
    
    voting.actions.CastVote.handler(v1Ctx as any);
    voting.actions.CastVote.handler(v2Ctx as any);

    expect(votePhase.getVotes()).toEqual({ 'p2_a1': 1, 'p1_a1': 1 });
  });
});
