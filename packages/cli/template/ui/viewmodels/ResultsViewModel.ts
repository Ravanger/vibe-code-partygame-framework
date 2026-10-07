import { ACTION } from "../../src/actionNames.js";
import type { __PascalName__Manager } from "../manager.js";

/** The winner line and the host's play-again button. */
export class ResultsViewModel {
  constructor(private readonly manager: __PascalName__Manager) {}

  get headline(): string {
    const state = this.manager.state;
    if (state === undefined || state.winnerName === "") return "Nobody waved.";
    return `${state.winnerName} wins with ${state.winnerWaves} waves!`;
  }

  get isHost(): boolean {
    return this.manager.isHost;
  }

  async playAgain(): Promise<void> {
    await this.manager.sendAction(ACTION.PLAY_AGAIN, {});
  }
}
