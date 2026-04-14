/**
 * Core types for the game framework engine.
 */

/**
 * Roles allowed in a game session.
 */
export type PlayerRole = "host" | "player" | "audience";

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
  actions: Record<string, ActionDefinition<TState, any>>;
}

/**
 * The primary definition interface for creating a new game.
 */
export interface GameDefinition<TState> {
  name: string;
  minPlayers: number;
  maxPlayers: number;
  initialState: () => TState;
  phases: Record<string, PhaseDefinition<TState>>;
}
