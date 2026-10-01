import type { GameContext, PhaseDefinition } from "@partygame/core";
import type { AnswerRecord } from "./bestAnswers.js";
import type { CategoryRepository } from "./content/CategoryRepository.js";
import type { WitClashOptions } from "./options.js";
import type { MatchupAward } from "./scoring.js";
import type { WitClashState } from "./state.js";
import type { TieBreakerPlan } from "./tieBreaker.js";

export type WitClashContext = GameContext<WitClashState, WitClashPrivate, WitClashOptions>;
export type WitClashPhase = PhaseDefinition<WitClashState, WitClashPrivate, WitClashOptions>;

/** Server-only game state: content, authorship, drafts, votes and scores. Everything is keyed by playerId. */
export class WitClashPrivate {
  scores: Record<string, number> = {};
  names: Record<string, string> = {};
  participants = new Set<string>();
  usedPromptIds = new Set<string>();
  categoryId = "";
  categoryVotes = new Map<string, string>();
  assignments = new Map<string, string[]>();
  drafts = new Map<string, Map<string, string>>();
  authors = new Map<string, string>();
  placeholders = new Set<string>();
  matchupVotes = new Map<string, string>();
  roundAwards: MatchupAward[] = [];
  answerHistory: AnswerRecord[] = [];
  tieBreakerPlan: TieBreakerPlan | undefined;
  tieBreakerWinnerId = "";

  constructor(readonly content: CategoryRepository) {}

  clearRound(): void {
    this.categoryId = "";
    this.categoryVotes.clear();
    this.assignments.clear();
    this.drafts.clear();
    this.authors.clear();
    this.placeholders.clear();
    this.matchupVotes.clear();
    this.roundAwards = [];
    this.tieBreakerPlan = undefined;
  }

  clearGame(): void {
    this.clearRound();
    this.scores = {};
    this.names = {};
    this.participants.clear();
    this.usedPromptIds.clear();
    this.answerHistory = [];
    this.tieBreakerWinnerId = "";
  }
}
