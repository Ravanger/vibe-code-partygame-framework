import { it, expect } from 'vitest';
import type { PhaseHandler } from '../src/phases/types.js';
import type { GameAction } from '@partygame/shared';

it('should be implemented by a class', () => {
  class MockPhase implements PhaseHandler {
    handleAction(player: string, action: GameAction) {}
    computeVisibility() { return {}; }
  }
  const handler: PhaseHandler = new MockPhase();
  expect(handler).toBeDefined();
});
