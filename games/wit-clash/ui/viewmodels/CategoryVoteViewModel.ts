import type { Countdown } from "@partygame/game-client";
import { ACTION } from "../../src/actionNames.js";
import type { WitClashManager } from "../manager.js";

const ANNOUNCE_AT = [30, 10, 5];

export interface CategoryChoice {
  id: string;
  name: string;
  emoji: string;
  votes: number;
}

export class CategoryVoteViewModel {
  private readonly countdown: Countdown;

  constructor(private readonly manager: WitClashManager) {
    this.countdown = manager.countdown();
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
    return this.countdown.secondsLeft;
  }

  get isUrgent(): boolean {
    return this.countdown.isUrgent;
  }

  get announcement(): string {
    return ANNOUNCE_AT.includes(this.secondsLeft) ? `${this.secondsLeft} seconds remaining` : "";
  }

  async vote(categoryId: string): Promise<void> {
    await this.manager.sendAction(ACTION.VOTE_CATEGORY, { categoryId });
  }

  destroy(): void {
    this.countdown.destroy();
  }
}
