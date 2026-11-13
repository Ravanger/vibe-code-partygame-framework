import { LobbySettingsViewModel as LobbySettingsBase } from "@partygame/game-ui";
import { BluffOptionsSchema, DEFAULT_OPTIONS } from "../../src/options.js";
import type { BluffState } from "../../src/state.js";
import type { BluffManager } from "../manager.js";

export class LobbySettingsViewModel extends LobbySettingsBase<BluffState> {
  constructor(manager: BluffManager) {
    super(manager, { schema: BluffOptionsSchema, defaults: DEFAULT_OPTIONS });
  }
}
