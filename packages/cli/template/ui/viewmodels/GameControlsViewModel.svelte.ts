import { GameControlsViewModel as GameControlsBase } from "@partygame/game-ui";
import { isGameOver } from "../../src/isGameOver.js";
import type { __PascalName__State } from "../../src/state.js";
import type { __PascalName__Manager } from "../manager.js";

/** Leave and, for the host, end the game — except on results, where play-again wins. */
export class GameControlsViewModel extends GameControlsBase<__PascalName__State> {
  constructor(manager: __PascalName__Manager) {
    super(manager, isGameOver);
  }
}
