import { NameField } from "@partygame/game-ui";
import { LOBBY_PHASE } from "@partygame/shared";
import type { WitClashManager } from "../manager.js";
import { isKnownPhase, PHASE_SCREENS } from "../screens/index.js";
import { Scoreboard } from "./Scoreboard.js";

/** For someone who joined mid-game and plays from the next round on. */
export class JoinNextRoundViewModel {
  readonly scoreboard: Scoreboard;
  readonly nameField: NameField;

  constructor(private readonly manager: WitClashManager) {
    this.scoreboard = new Scoreboard(manager);
    this.nameField = new NameField(manager);
  }

  get needsName(): boolean {
    return this.manager.me()?.isReady === false;
  }

  private get isLastRound(): boolean {
    const state = this.manager.state;
    return state !== undefined && state.roundNumber > 0 && state.roundNumber >= state.totalRounds;
  }

  get heading(): string {
    if (this.needsName) return "Pick a name to join";
    return this.isLastRound ? "You'll join the next game" : "You'll join next round";
  }

  get hint(): string {
    if (this.needsName) return "You need a name before you can play.";
    return this.isLastRound ? "You'll join when the host starts a new game." : "";
  }

  get phaseLabel(): string {
    const phase = this.manager.state?.phase ?? LOBBY_PHASE;
    return isKnownPhase(phase) ? PHASE_SCREENS[phase].waitingLabel : phase;
  }

  get roundLabel(): string {
    const state = this.manager.state;
    return state?.roundNumber ? `Round ${state.roundNumber} of ${state.totalRounds}` : "";
  }

  destroy(): void {
    this.nameField.destroy();
  }
}
