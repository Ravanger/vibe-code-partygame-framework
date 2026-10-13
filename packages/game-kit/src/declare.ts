import type { BaseGameState } from "@partygame/shared/schema";
import type { GameDeclaration } from "./types.js";

/** Types a game's declaration and returns it unchanged. */
export const defineGamePackage = <TState extends BaseGameState, TContent>(
  pkg: GameDeclaration<TState, TContent>,
): GameDeclaration<TState, TContent> => pkg;
