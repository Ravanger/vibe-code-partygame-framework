import { JoinNextRoundViewModel as BaseJoinNextRound } from "@partygame/game-ui";
import type { WitClashState } from "../../src/state.js";
import type { WitClashManager } from "../manager.js";
import { PHASE_SCREENS } from "../screens/index.js";
import { Scoreboard } from "./Scoreboard.js";

/** For someone who joined mid-game and plays from the next round on. */
export class JoinNextRoundViewModel extends BaseJoinNextRound<WitClashState, typeof PHASE_SCREENS> {
  readonly scoreboard: Scoreboard;

  constructor(manager: WitClashManager) {
    super(manager, PHASE_SCREENS);
    this.scoreboard = new Scoreboard(manager);
  }

  private get isLastRound(): boolean {
    const state = this.manager.state;
    return state !== undefined && state.roundNumber > 0 && state.roundNumber >= state.totalRounds;
  }

  override get heading(): string {
    if (this.needsName) return "Pick a name to join";
    return this.isLastRound ? "You'll join the next game" : "You'll join next round";
  }

  override get hint(): string {
    if (this.needsName) return "You need a name before you can play.";
    return this.isLastRound ? "You'll join when the host starts a new game." : "";
  }

  /** The current round, e.g. "Round 2 of 3"; empty before the first round. */
  get roundLabel(): string {
    const state = this.manager.state;
    return state?.roundNumber ? `Round ${state.roundNumber} of ${state.totalRounds}` : "";
  }
}
