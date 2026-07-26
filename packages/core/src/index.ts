import type { ActionDefinition, GameDefinition, PhaseDefinition } from "./types.js";

export { buildXStateMachine } from "./machine.js";
export * from "./phases/PromptPhase.js";
export * from "./phases/types.js";
export * from "./phases/VotePhase.js";
export * from "./scoring.js";
export {
  ActionDefinition,
  GameDefinition,
  GameVisibilityConfig,
  PhaseDefinition,
  VisibilityPredicate,
} from "./types.js";
export { enforceVisibility } from "./visibility.js";

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
