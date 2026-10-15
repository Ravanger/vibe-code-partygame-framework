import { OptionsReader, PhaseClock } from "@partygame/game-ui";
import { DEFAULT_OPTIONS, type WitClashOptions, WitClashOptionsSchema } from "../../src/options.js";
import type { WitClashManager } from "../manager.js";
import { MatchupRecap, type RevealedMatchup } from "./MatchupRecap.js";

export class MatchupRevealViewModel {
  private readonly clock: PhaseClock;
  private readonly recap: MatchupRecap;

  constructor(private readonly manager: WitClashManager) {
    const options = new OptionsReader<WitClashOptions>(
      manager,
      WitClashOptionsSchema,
      DEFAULT_OPTIONS,
    );
    this.clock = new PhaseClock(manager, () => options.current.revealSeconds);
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
    return this.clock.secondsLeft;
  }

  get totalSeconds(): number {
    return this.clock.totalSeconds;
  }

  get myVoteId(): string {
    return this.manager.state?.mine.get(this.manager.playerId)?.matchupVote ?? "";
  }

  destroy(): void {
    this.clock.destroy();
  }
}
