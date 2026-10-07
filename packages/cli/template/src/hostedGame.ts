import type { HostedGame } from "@partygame/server";
import { create__PascalName__Game } from "./game.js";
import { ROOM_NAME } from "./roomName.js";
import { __PascalName__State } from "./state.js";

/** The wave game as a game a server can host. */
export function __camelName__Game(): HostedGame {
  return {
    roomName: ROOM_NAME,
    definition: create__PascalName__Game(),
    stateClass: __PascalName__State,
  };
}
