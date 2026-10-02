import type { GameConnectionManager } from "@partygame/game-client";
import { END_GAME, LOBBY_PHASE } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";

/** Leave and, for the host, end the game: shown in every phase except the lobby, which has its own leave button. */
export class GameControlsViewModel<TState extends BaseGameState> {
  confirmingEnd = $state(false);
  menuOpen = $state(false);

  constructor(
    private readonly manager: GameConnectionManager<TState>,
    private readonly gameOver: (state: TState) => boolean = () => false,
  ) {}

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
    return state !== undefined && this.gameOver(state);
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
