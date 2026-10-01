import { LOBBY_PHASE } from "@partygame/shared";
import { ACTION } from "../../src/actionNames.js";
import type { WitClashManager } from "../manager.js";

/** Leave and, for the host, end the game: shown on every screen except the lobby, which has its own leave button. */
export class GameControlsViewModel {
  confirmingEnd = $state(false);

  constructor(private readonly manager: WitClashManager) {}

  get isVisible(): boolean {
    const { status, state } = this.manager;
    const connected = status === "connected" || status === "reconnecting";
    return connected && state !== undefined && state.phase !== LOBBY_PHASE;
  }

  get canEndGame(): boolean {
    return this.isVisible && this.manager.isHost;
  }

  askEnd(): void {
    this.confirmingEnd = true;
  }

  cancelEnd(): void {
    this.confirmingEnd = false;
  }

  async confirmEnd(): Promise<void> {
    this.confirmingEnd = false;
    if (this.canEndGame) await this.manager.sendAction(ACTION.END_GAME);
  }

  async leave(): Promise<void> {
    await this.manager.leave();
  }
}
