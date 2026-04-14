import { GameDefinition, ActionDefinition, PhaseDefinition } from "./types.js";
export { GameDefinition, ActionDefinition, PhaseDefinition } from "./types.js";
export { buildXStateMachine } from "./machine.js";

export function defineGame<TState>(config: GameDefinition<TState>): GameDefinition<TState> {
  return config;
}

export function createAction<TState, TPayload>(config: ActionDefinition<TState, TPayload>): ActionDefinition<TState, TPayload> {
  return config;
}

export function createPhase<TState>(config: PhaseDefinition<TState>): PhaseDefinition<TState> {
  return config;
}
