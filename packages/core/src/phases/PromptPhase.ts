import type { PhaseHandler } from './types.js';
import type { GameAction } from '@partygame/shared';

export class PromptPhase implements PhaseHandler {
  handleAction(player: string, action: GameAction) {
    if (action.type !== 'SubmitAnswer') {
      throw new Error('Invalid Action');
    }
  }
  computeVisibility() { return { phase: 'Prompting' }; }
}
