import type { GameContext, PhaseDefinition } from "@partygame/core";
import { RosterLedger } from "@partygame/core";
import type { CrewOptions } from "./options.js";
import type { CrewState } from "./state.js";

export type CrewContext = GameContext<CrewState, CrewPrivate, CrewOptions>;
export type CrewPhase = PhaseDefinition<CrewState, CrewPrivate, CrewOptions>;

/** The one slot every player fills in a Round; the kit's Responses shape is playerId -> slot -> choice. */
export const CHOICE_SLOT = "choice";

/** Server-only game state: signals, roster and per-round choices. Everything is keyed by playerId. */
export class CrewPrivate {
  signals: Record<string, number> = {};
  roster = new RosterLedger();
  responses = new Map<string, Map<string, string>>();
  target = 0;

  clearRound(): void {
    this.responses.clear();
  }

  clearGame(): void {
    this.signals = {};
    this.roster.clear();
    this.target = 0;
    this.clearRound();
  }
}
