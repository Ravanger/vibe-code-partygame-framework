import type { GameVisibilityConfig } from "./types.js";

/**
 * Utility to enforce visibility rules based on predicates.
 */
export function enforceVisibility<TState, TPlayer>(
  state: TState,
  viewer: TPlayer,
  config: GameVisibilityConfig<TState, TPlayer>,
): Partial<TState> {
  const filteredState = { ...state } as Partial<TState> & Record<string, unknown>;

  for (const [key, predicate] of Object.entries(config)) {
    if (!predicate(state, viewer)) {
      delete filteredState[key];
    }
  }

  return filteredState;
}
