import { ACTION } from "../../src/actionNames.js";
import type { CastVotePayload } from "../../src/actions.js";
import type { Matchup } from "../../src/state.js";
import type { WitClashManager } from "../manager.js";
import { PhaseClock } from "./PhaseClock.js";

export interface VoteChoice {
  id: string;
  text: string;
  isMine: boolean;
}

/** Voting on the active matchup. Who wrote what, and the counts, stay hidden until the reveal. */
export class MatchupVoteViewModel {
  private readonly clock: PhaseClock;

  constructor(private readonly manager: WitClashManager) {
    this.clock = new PhaseClock(manager, "voteSeconds");
  }

  private get matchup(): Matchup | undefined {
    const state = this.manager.state;
    return state?.matchups[state.activeMatchupIndex];
  }

  private get mine() {
    return this.manager.state?.mine.get(this.manager.playerId);
  }

  get isSpectator(): boolean {
    return this.manager.isSpectator;
  }

  get promptText(): string {
    return this.matchup?.promptText ?? "";
  }

  get matchupNumber(): number {
    return (this.manager.state?.activeMatchupIndex ?? -1) + 1;
  }

  get totalMatchups(): number {
    return this.manager.state?.matchups.length ?? 0;
  }

  get choices(): VoteChoice[] {
    const picked = this.mine?.matchupVote;
    return [...(this.matchup?.answers ?? [])].map((a) => ({
      id: a.id,
      text: a.text,
      isMine: a.id === picked,
    }));
  }

  get isForfeit(): boolean {
    return this.matchup?.isForfeit ?? false;
  }

  get isOwnMatchup(): boolean {
    return this.mine?.isOwnMatchup ?? false;
  }

  get canVote(): boolean {
    return (this.mine?.canVote ?? false) && !this.isForfeit;
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

  get isUrgent(): boolean {
    return this.clock.isUrgent;
  }

  get announcement(): string {
    return this.clock.announcement;
  }

  get totalSeconds(): number {
    return this.clock.totalSeconds;
  }

  async vote(answerId: string): Promise<void> {
    const payload: CastVotePayload = { answerId };
    if (this.canVote) await this.manager.sendAction(ACTION.CAST_VOTE, payload);
  }

  destroy(): void {
    this.clock.destroy();
  }
}
