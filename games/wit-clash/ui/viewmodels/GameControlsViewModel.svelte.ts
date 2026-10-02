import { GameControlsViewModel as GameControlsBase } from "@partygame/game-ui";
import { isGameOver } from "../../src/isGameOver.js";
import type { WitClashState } from "../../src/state.js";
import type { WitClashManager } from "../manager.js";

/** Leave and, for the host, end the game: shown on every screen except the lobby, which has its own leave button. */
export class GameControlsViewModel extends GameControlsBase<WitClashState> {
  constructor(manager: WitClashManager) {
    super(manager, isGameOver);
  }
}
