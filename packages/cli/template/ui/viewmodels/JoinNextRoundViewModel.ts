import { NameField } from "@partygame/game-ui";
import { LOBBY_PHASE } from "@partygame/shared";
import type { __PascalName__Manager } from "../manager.js";
import { isKnownPhase, PHASE_SCREENS } from "../screens/index.js";

/** For someone who joined mid-game and plays from the next game on. */
export class JoinNextRoundViewModel {
  readonly nameField: NameField;

  constructor(private readonly manager: __PascalName__Manager) {
    this.nameField = new NameField(this.manager);
  }

  get needsName(): boolean {
    return this.manager.me()?.isReady === false;
  }

  get heading(): string {
    return this.needsName ? "Pick a name to join" : "You'll join the next game";
  }

  get hint(): string {
    return this.needsName
      ? "You need a name before you can play."
      : "You'll join when the host starts a new game.";
  }

  get phaseLabel(): string {
    const phase = this.manager.state?.phase ?? LOBBY_PHASE;
    return isKnownPhase(phase) ? PHASE_SCREENS[phase].waitingLabel : phase;
  }

  destroy(): void {
    this.nameField.destroy();
  }
}
