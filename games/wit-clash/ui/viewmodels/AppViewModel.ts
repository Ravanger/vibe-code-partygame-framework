import { AppRouter } from "@partygame/game-ui";
import { PHASE } from "../../src/phaseNames.js";
import type { WitClashState } from "../../src/state.js";
import type { WitClashManager } from "../manager.js";
import { PHASE_SCREENS } from "../screens/index.js";

export class AppViewModel extends AppRouter<WitClashState, typeof PHASE_SCREENS> {
  constructor(manager: WitClashManager) {
    super(manager, PHASE_SCREENS);
  }

  override get banner(): string {
    const laterMatchup = (this.manager.state?.activeMatchupIndex ?? 0) > 0;
    return this.phase === PHASE.MatchupVoting && laterMatchup ? "" : super.banner;
  }
}
