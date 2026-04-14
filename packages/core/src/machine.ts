import { createMachine, assign } from "xstate";
import { GameDefinition } from "./types.js";

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
