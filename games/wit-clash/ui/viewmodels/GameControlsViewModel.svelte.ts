import { END_GAME, LOBBY_PHASE } from "@partygame/shared";
import { isGameOver } from "../../src/isGameOver.js";
import type { WitClashManager } from "../manager.js";

/** Leave and, for the host, end the game: shown on every screen except the lobby, which has its own leave button. */
export class GameControlsViewModel {
  confirmingEnd = $state(false);
  menuOpen = $state(false);

  constructor(private readonly manager: WitClashManager) {}

  get isVisible(): boolean {
    const { status, state } = this.manager;
    const connected = status === "connected" || status === "reconnecting";
    return connected && state !== undefined && state.phase !== LOBBY_PHASE;
  }

  get isSpectator(): boolean {
    return this.manager.isSpectator;
  }

  get isGameOver(): boolean {
    const state = this.manager.state;
    return state !== undefined && isGameOver(state);
  }

  get canEndGame(): boolean {
    return this.isVisible && this.manager.isHost && !this.isGameOver;
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    this.confirmingEnd = false;
  }

  closeMenu(): void {
    this.menuOpen = false;
    this.confirmingEnd = false;
  }

  askEnd(): void {
    this.confirmingEnd = true;
  }

  cancelEnd(): void {
    this.confirmingEnd = false;
  }

  async confirmEnd(): Promise<void> {
    this.closeMenu();
    if (this.canEndGame) await this.manager.sendAction(END_GAME);
  }

  async leave(): Promise<void> {
    this.closeMenu();
    await this.manager.leave();
  }
}
