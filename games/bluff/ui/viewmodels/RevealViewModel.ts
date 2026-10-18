import { OptionsReader, PhaseClock } from "@partygame/game-ui";
import { type BluffOptions, BluffOptionsSchema, DEFAULT_OPTIONS } from "../../src/options.js";
import type { BluffManager } from "../manager.js";

export interface RevealChoiceRow {
  id: string;
  text: string;
  authorName: string;
  votes: number;
  isTruth: boolean;
}

export interface RoundResultRow {
  playerId: string;
  name: string;
  roundPoints: number;
  fooledCount: number;
  guessedTruth: boolean;
}

/** The revealed options with their authors and votes, plus who scored this round. */
export class RevealViewModel {
  private readonly clock: PhaseClock;

  constructor(private readonly manager: BluffManager) {
    const options = new OptionsReader<BluffOptions>(manager, BluffOptionsSchema, DEFAULT_OPTIONS);
    this.clock = new PhaseClock(manager, () => options.current.revealSeconds);
  }

  get roundLabel(): string {
    const state = this.manager.state;
    return `Round ${state?.roundNumber ?? 0} of ${state?.totalRounds ?? 0}`;
  }

  get choices(): RevealChoiceRow[] {
    const state = this.manager.state;
    if (state === undefined) return [];
    return [...state.choices].map((choice) => ({
      id: choice.id,
      text: choice.text,
      authorName: choice.authorName,
      votes: choice.votes,
      isTruth: choice.id === state.truthRevealedId,
    }));
  }

  get results(): RoundResultRow[] {
    const state = this.manager.state;
    if (state === undefined) return [];
    return [...state.results].map((entry) => ({
      playerId: entry.playerId,
      name: entry.name,
      roundPoints: entry.roundPoints,
      fooledCount: entry.fooledCount,
      guessedTruth: entry.guessedTruth,
    }));
  }

  get secondsLeft(): number {
    return this.clock.secondsLeft;
  }

  get totalSeconds(): number {
    return this.clock.totalSeconds;
  }
}
