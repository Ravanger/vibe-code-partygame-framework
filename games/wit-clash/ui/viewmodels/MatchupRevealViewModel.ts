import type { Countdown } from "@partygame/game-client";
import type { WitClashManager } from "../manager.js";
import { MatchupRecap, type RevealedMatchup } from "./MatchupRecap.js";

export class MatchupRevealViewModel {
  private readonly countdown: Countdown;
  private readonly recap: MatchupRecap;

  constructor(private readonly manager: WitClashManager) {
    this.countdown = manager.countdown();
    this.recap = new MatchupRecap(manager);
  }

  get matchup(): RevealedMatchup | undefined {
    return this.recap.active;
  }

  get matchupNumber(): number {
    return (this.manager.state?.activeMatchupIndex ?? -1) + 1;
  }

  get totalMatchups(): number {
    return this.manager.state?.matchups.length ?? 0;
  }

  get secondsLeft(): number {
    return this.countdown.secondsLeft;
  }

  destroy(): void {
    this.countdown.destroy();
  }
}
