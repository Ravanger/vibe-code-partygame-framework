import { LobbySettingsViewModel as LobbySettingsBase } from "@partygame/game-ui";
import { DEFAULT_OPTIONS, WitClashOptionsSchema } from "../../src/options.js";
import type { WitClashState } from "../../src/state.js";
import type { WitClashManager } from "../manager.js";

export class LobbySettingsViewModel extends LobbySettingsBase<WitClashState> {
  constructor(manager: WitClashManager) {
    super(manager, { schema: WitClashOptionsSchema, defaults: DEFAULT_OPTIONS });
  }
}
