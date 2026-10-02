import { ACTION } from "../../src/actionNames.js";
import type { WitClashManager } from "../manager.js";
import { PhaseClock } from "./PhaseClock.js";

export interface CategoryChoice {
  id: string;
  name: string;
  emoji: string;
  votes: number;
}

export class CategoryVoteViewModel {
  private readonly clock: PhaseClock;

  constructor(private readonly manager: WitClashManager) {
    this.clock = new PhaseClock(manager, "categoryVoteSeconds");
  }

  get isSpectator(): boolean {
    return this.manager.isSpectator;
  }

  get options(): CategoryChoice[] {
    return [...(this.manager.state?.categoryOptions ?? [])].map((o) => ({
      id: o.id,
      name: o.name,
      emoji: o.emoji,
      votes: o.votes,
    }));
  }

  get myVote(): string {
    return this.manager.state?.mine.get(this.manager.playerId)?.categoryVote ?? "";
  }

  get votesCast(): number {
    return this.manager.state?.votesCast ?? 0;
  }

  get votesExpected(): number {
    return this.manager.state?.votesExpected ?? 0;
  }

  get roundLabel(): string {
    const state = this.manager.state;
    return `Round ${state?.roundNumber ?? 0} of ${state?.totalRounds ?? 0}`;
  }

  get secondsLeft(): number {
    return this.clock.secondsLeft;
  }

  get isUrgent(): boolean {
    return this.clock.isUrgent;
  }

  get announcement(): string {
    return this.clock.announcement;
  }

  get totalSeconds(): number {
    return this.clock.totalSeconds;
  }

  async vote(categoryId: string): Promise<void> {
    await this.manager.sendAction(ACTION.VOTE_CATEGORY, { categoryId });
  }

  destroy(): void {
    this.clock.destroy();
  }
}
