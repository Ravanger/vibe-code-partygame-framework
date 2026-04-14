import { GameDefinition } from "./types.js";
export { buildXStateMachine } from "./machine.js";

export function defineGame<TState>(config: GameDefinition<TState>): GameDefinition<TState> {
  return config;
}
