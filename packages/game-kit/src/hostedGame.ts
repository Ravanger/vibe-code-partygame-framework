import type { HostedGame } from "@partygame/server";
import type { BaseGameState } from "@partygame/shared/schema";
import type { GameDeclaration } from "./types.js";

/** The `HostedGame` a server hosts for this declaration and its loaded content. */
export function hostedGame<TState extends BaseGameState, TContent>(
  pkg: GameDeclaration<TState, TContent>,
  content: TContent | undefined,
): HostedGame {
  return {
    roomName: pkg.meta.roomName,
    definition: pkg.definition(content as TContent),
    stateClass: pkg.stateClass,
  };
}
