import { OptionsReader, PhaseClock, roundLabel } from "@partygame/game-ui";
import { ACTION } from "../../src/actionNames.js";
import { DEFAULT_OPTIONS, type WitClashOptions, WitClashOptionsSchema } from "../../src/options.js";
import type { WitClashManager } from "../manager.js";

export interface CategoryChoice {
  id: string;
  name: string;
  emoji: string;
  votes: number;
}

export class CategoryVoteViewModel {
  readonly clock: PhaseClock;

  constructor(private readonly manager: WitClashManager) {
    const options = new OptionsReader<WitClashOptions>(
      manager,
      WitClashOptionsSchema,
      DEFAULT_OPTIONS,
    );
    this.clock = new PhaseClock(manager, () => options.current.categoryVoteSeconds);
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
    return roundLabel(state?.roundNumber ?? 0, state?.totalRounds ?? 0);
  }

  async vote(categoryId: string): Promise<void> {
    await this.manager.sendAction(ACTION.VOTE_CATEGORY, { categoryId });
  }
}
