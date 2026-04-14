import { GameDefinition } from "./types";

export function defineGame<TState>(config: GameDefinition<TState>): GameDefinition<TState> {
  return config;
}
