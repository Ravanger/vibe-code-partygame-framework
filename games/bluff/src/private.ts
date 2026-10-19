import type { GameContext, PhaseDefinition } from "@partygame/core";
import type { PromptRepository } from "./content/PromptRepository.js";
import type { BluffOptions } from "./options.js";
import type { BluffState } from "./state.js";

export type BluffContext = GameContext<BluffState, BluffPrivate, BluffOptions>;
export type BluffPhase = PhaseDefinition<BluffState, BluffPrivate, BluffOptions>;

/** The one slot every author fills in the Writing phase; the kit's Responses shape is playerId -> slot -> text. */
export const FAKE_SLOT = "fake";

/** Server-only game state: content, fakes, option authorship and votes. Everything is keyed by playerId. */
export class BluffPrivate {
  scores: Record<string, number> = {};
  names: Record<string, string> = {};
  participants = new Set<string>();
  usedPromptIds = new Set<string>();
  currentPromptId = "";
  fakes = new Map<string, Map<string, string>>();
  /** Option id -> author's playerId; empty string for the truth option. */
  optionAuthor = new Map<string, string>();
  truthOptionId = "";
  /** Voter's playerId -> chosen option id. */
  votes = new Map<string, string>();

  constructor(readonly prompts: PromptRepository) {}

  clearRound(): void {
    this.currentPromptId = "";
    this.fakes.clear();
    this.optionAuthor.clear();
    this.truthOptionId = "";
    this.votes.clear();
  }

  clearGame(): void {
    this.clearRound();
    this.scores = {};
    this.names = {};
    this.participants.clear();
    this.usedPromptIds.clear();
  }
}
