/**
 * Core types for the game framework engine.
 */

/**
 * Roles allowed in a game session.
 */
export type PlayerRole = "host" | "player" | "audience";

import { PlayerSchema } from "../../server/src/schema/PlayerSchema.js";
import { GameStateSchema } from "../../server/src/schema/GameStateSchema.js";

/**
 * Predicate type for visibility filtering.
 */
export type VisibilityPredicate = (state: GameStateSchema, viewer: PlayerSchema) => boolean;

/**
 * Visibility configuration for the game.
 */
export interface GameVisibilityConfig {
  [key: string]: VisibilityPredicate;
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
  visibility?: GameVisibilityConfig;
}
