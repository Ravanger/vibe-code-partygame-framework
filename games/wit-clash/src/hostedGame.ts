import type { HostedGame } from "@partygame/server";
import type { CategoryRepository } from "./content/CategoryRepository.js";
import { createWitClashGame } from "./game.js";
import { ROOM_NAME } from "./roomName.js";
import { WitClashState } from "./state.js";

/** WitClash as a game a server can host. */
export function witClashGame(categories: CategoryRepository): HostedGame {
  return {
    roomName: ROOM_NAME,
    definition: createWitClashGame({ categories }),
    stateClass: WitClashState,
  };
}
