import { createMachine } from "xstate";
import type { GameDefinition } from "./types.js";

export function buildXStateMachine<TState>(gameDef: GameDefinition<TState>) {
  return createMachine({
    id: "game",
    initial: "lobby",
    context: {
      currentPhase: "lobby",
      gameState: gameDef.initialState(),
    },
    states: {
      lobby: {},
    },
  });
}
