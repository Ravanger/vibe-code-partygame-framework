import type { GameConnectionManager } from "@partygame/game-client";
import { LOBBY_PHASE } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";
import type { RouterScreen } from "./AppRouter.js";
import { NameField } from "./NameField.svelte.js";

/** For someone who joined mid-game and plays from the next round or game on. */
export class JoinNextRoundViewModel<
  TState extends BaseGameState,
  TScreens extends Readonly<Record<string, RouterScreen & { waitingLabel: string }>>,
> {
  readonly nameField: NameField<TState>;

  constructor(
    protected readonly manager: GameConnectionManager<TState>,
    private readonly screens: TScreens,
  ) {
    this.nameField = new NameField(manager);
  }

  /** True while the seat still has no confirmed name. */
  get needsName(): boolean {
    return this.manager.me()?.isReady === false;
  }

  /** The screen's heading: a request for a name, or the promise of a place in the next game. */
  get heading(): string {
    return this.needsName ? "Pick a name to join" : "You'll join the next game";
  }

  /** The screen's hint under the heading. */
  get hint(): string {
    return this.needsName
      ? "You need a name before you can play."
      : "You'll join when the host starts a new game.";
  }

  /** The waiting label of the phase's screen, or the raw phase name when it has none. */
  get phaseLabel(): string {
    const phase = this.manager.state?.phase ?? LOBBY_PHASE;
    return this.screens[phase]?.waitingLabel ?? phase;
  }

  /** Sends an unflushed rename and stops the field's debounce. */
  destroy(): void {
    this.nameField.destroy();
  }
}
