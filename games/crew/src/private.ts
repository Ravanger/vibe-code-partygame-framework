import type { GameContext, PhaseDefinition } from "@partygame/core";
import type { CrewOptions } from "./options.js";
import type { CrewState } from "./state.js";

export type CrewContext = GameContext<CrewState, CrewPrivate, CrewOptions>;
export type CrewPhase = PhaseDefinition<CrewState, CrewPrivate, CrewOptions>;

/** The one slot every player fills in a Round; the kit's Responses shape is playerId -> slot -> choice. */
export const CHOICE_SLOT = "choice";

/** Server-only game state: signals, names and per-round choices. Everything is keyed by playerId. */
export class CrewPrivate {
  signals: Record<string, number> = {};
  names: Record<string, string> = {};
  participants = new Set<string>();
  responses = new Map<string, Map<string, string>>();
  target = 0;

  clearRound(): void {
    this.responses.clear();
  }

  clearGame(): void {
    this.signals = {};
    this.names = {};
    this.participants.clear();
    this.target = 0;
    this.clearRound();
  }
}
