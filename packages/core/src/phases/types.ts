import type { GameAction } from '@partygame/shared';

export interface PhaseHandler {
  handleAction(player: string, action: GameAction): void;
  computeVisibility(): any;
}
