/**
 * Core types for the game framework engine.
 */

/**
 * Roles allowed in a game session.
 */
export type PlayerRole = "host" | "player" | "audience";

/**
 * Predicate type for visibility filtering.
 * TState and TPlayer are generics to avoid server dependency.
 */
export type VisibilityPredicate<TState, TPlayer> = (state: TState, viewer: TPlayer) => boolean;

/**
 * Visibility configuration for the game.
 */
export interface GameVisibilityConfig<TState, TPlayer> {
  [key: string]: VisibilityPredicate<TState, TPlayer>;
}

/**
 * Definition of an action that can be performed in the game.
 */
export interface ActionDefinition<TState, TPayload> {
  from: PlayerRole;
  handler: (ctx: { state: TState; clientId: string; data: TPayload }) => void;
}

/**
 * Definition of a game phase.
 */
export interface PhaseDefinition<TState> {
  duration?: number;
  // biome-ignore lint/suspicious/noExplicitAny: Action payloads can be any type
  actions: Record<string, ActionDefinition<TState, any>>;
}

/**
 * The primary definition interface for creating a new game.
 */
export interface GameDefinition<TState, TPlayer = unknown> {
  name: string;
  minPlayers: number;
  maxPlayers: number;
  initialState: () => TState;
  phases: Record<string, PhaseDefinition<TState>>;
  visibility?: GameVisibilityConfig<TState, TPlayer>;
}
