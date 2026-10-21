import { OptionsReader, PhaseClock } from "@partygame/game-ui";
import { ACTION } from "../../src/actionNames.js";
import type { VoteHonorPayload } from "../../src/actions.js";
import { DEFAULT_OPTIONS, type WitClashOptions, WitClashOptionsSchema } from "../../src/options.js";
import type { WitClashManager } from "../manager.js";

export interface HonorChoice {
  id: string;
  name: string;
  text: string;
  isMine: boolean;
}

/** The optional honor vote: the table picks the funniest of the game's best answers. */
export class HonorVoteViewModel {
  private readonly clock: PhaseClock;

  constructor(private readonly manager: WitClashManager) {
    const options = new OptionsReader<WitClashOptions>(
      manager,
      WitClashOptionsSchema,
      DEFAULT_OPTIONS,
    );
    this.clock = new PhaseClock(manager, () => options.current.voteSeconds);
  }

  private get mine() {
    return this.manager.state?.mine.get(this.manager.playerId);
  }

  get isSpectator(): boolean {
    return this.manager.isSpectator;
  }

  /** One card per author of a best answer, in order; repeated authors appear once. */
  get choices(): HonorChoice[] {
    const state = this.manager.state;
    if (state === undefined) return [];
    const picked = this.mine?.honorVote;
    const seen = new Set<string>();
    const choices: HonorChoice[] = [];
    for (const answer of state.bestAnswers) {
      if (seen.has(answer.authorId)) continue;
      seen.add(answer.authorId);
      choices.push({
        id: answer.authorId,
        name: answer.authorName,
        text: answer.text,
        isMine: answer.authorId === picked,
      });
    }
    return choices;
  }

  get canVote(): boolean {
    return this.mine?.canVote ?? false;
  }

  get votesCast(): number {
    return this.manager.state?.votesCast ?? 0;
  }

  get votesExpected(): number {
    return this.manager.state?.votesExpected ?? 0;
  }

  get secondsLeft(): number {
    return this.clock.secondsLeft;
  }

  get announcement(): string {
    return this.clock.announcement;
  }

  get totalSeconds(): number {
    return this.clock.totalSeconds;
  }

  async vote(authorId: string): Promise<void> {
    if (!this.canVote) return;
    const payload: VoteHonorPayload = { authorId };
    await this.manager.sendAction(ACTION.VOTE_HONOR, payload);
  }

  destroy(): void {
    this.clock.destroy();
  }
}
