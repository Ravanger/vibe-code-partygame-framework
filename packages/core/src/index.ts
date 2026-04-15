import type { ActionDefinition, GameDefinition, PhaseDefinition } from "./types.js";
export {
  GameDefinition,
  ActionDefinition,
  PhaseDefinition,
  VisibilityPredicate,
  GameVisibilityConfig,
} from "./types.js";
export { enforceVisibility } from "./visibility.js";
export * from "./phases/types.js";
export * from "./phases/PromptPhase.js";
export * from "./phases/VotePhase.js";
export { buildXStateMachine } from "./machine.js";

export function defineGame<TState>(config: GameDefinition<TState>): GameDefinition<TState> {
  return config;
}

export function createAction<TState, TPayload>(
  config: ActionDefinition<TState, TPayload>,
): ActionDefinition<TState, TPayload> {
  return config;
}

export function createPhase<TState>(config: PhaseDefinition<TState>): PhaseDefinition<TState> {
  return config;
}
