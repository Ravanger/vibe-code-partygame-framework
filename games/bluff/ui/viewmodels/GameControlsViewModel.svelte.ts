import { GameControlsViewModel as GameControlsBase } from "@partygame/game-ui";
import { isGameOver } from "../../src/isGameOver.js";
import type { BluffState } from "../../src/state.js";
import type { BluffManager } from "../manager.js";

/** Leave and, for the host, end the game — except on results, where play-again wins. */
export class GameControlsViewModel extends GameControlsBase<BluffState> {
  constructor(manager: BluffManager) {
    super(manager, isGameOver);
  }
}
