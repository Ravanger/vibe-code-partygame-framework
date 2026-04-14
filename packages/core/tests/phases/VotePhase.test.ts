import { it, expect, describe, beforeEach } from 'vitest';
import { VotePhase } from '../../src/phases/VotePhase.js';

describe('VotePhase', () => {
  let phase: VotePhase;

  beforeEach(() => {
    phase = new VotePhase();
  });

  it('should reject non-CastVote actions', () => {
    expect(() => phase.handleAction('p1', { type: 'SubmitAnswer', answer: '...' })).toThrow('Invalid Action');
  });

  it('should tally votes correctly', () => {
    phase.handleAction('p1', { type: 'CastVote', answerId: 'a1' });
    expect(phase.getVotes()).toEqual({ a1: 1 });
  });

  it('should prevent self-voting', () => {
    // Need to mock or set up state to know who owns a1
    // For now, this will fail until implemented
    expect(() => phase.handleAction('p1', { type: 'CastVote', answerId: 'p1_answer' })).toThrow('Cannot vote for self');
  });
});
