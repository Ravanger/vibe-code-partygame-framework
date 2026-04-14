import { it, expect, describe } from 'vitest';
import { PromptPhase } from '../../src/phases/PromptPhase.js';

describe('PromptPhase', () => {
  it('should reject non-SubmitAnswer actions', () => {
    const phase = new PromptPhase();
    expect(() => phase.handleAction('p1', { type: 'CastVote', answerId: '1' })).toThrow('Invalid Action');
  });

  it('should return correct visibility phase', () => {
    const phase = new PromptPhase();
    expect(phase.computeVisibility()).toEqual({ phase: 'Prompting' });
  });
});
