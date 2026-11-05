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

  /** True while connected and outside the lobby. */
  get isVisible(): boolean {
    const { status, state } = this.manager;
    const connected = status === "connected" || status === "reconnecting";
    return connected && state !== undefined && state.phase !== LOBBY_PHASE;
  }

  /** True while in the room without a seat. */
  get isSpectator(): boolean {
    return this.manager.isSpectator;
  }

  /** True once the game's own predicate reports the state as finished. */
  get isGameOver(): boolean {
    const state = this.manager.state;
    return state !== undefined && this.gameOver(state);
  }

  /** True for the host while the controls are visible and the game is not over. */
  get canEndGame(): boolean {
    return this.isVisible && this.manager.isHost && !this.isGameOver;
  }

  /** Opens or closes the menu and drops any pending end confirmation. */
  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    this.confirmingEnd = false;
  }

  /** Closes the menu and drops any pending end confirmation. */
  closeMenu(): void {
    this.menuOpen = false;
    this.confirmingEnd = false;
  }

  /** Asks the user to confirm ending the game. */
  askEnd(): void {
    this.confirmingEnd = true;
  }

  /** Withdraws the end-game confirmation. */
  cancelEnd(): void {
    this.confirmingEnd = false;
  }

  /** Closes the menu and sends `END_GAME`; does nothing unless `canEndGame`. */
  async confirmEnd(): Promise<void> {
    this.closeMenu();
    if (this.canEndGame) await this.manager.sendAction(END_GAME);
  }

  /** Closes the menu and leaves the room. */
  async leave(): Promise<void> {
    this.closeMenu();
    await this.manager.leave();
  }
}
