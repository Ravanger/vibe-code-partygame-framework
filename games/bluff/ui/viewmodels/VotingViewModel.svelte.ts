import { OptionsReader, PhaseClock } from "@partygame/game-ui";
import { ACTION } from "../../src/actionNames.js";
import { type BluffOptions, BluffOptionsSchema, DEFAULT_OPTIONS } from "../../src/options.js";
import type { BluffManager } from "../manager.js";

export interface ChoiceRow {
  id: string;
  text: string;
  isMine: boolean;
}

/** The shuffled options, the private "this one is yours" mark and the vote action. */
export class VotingViewModel {
  /** True once this client's vote was accepted by the server. */
  voted = $state(false);
  private readonly clock: PhaseClock;

  constructor(private readonly manager: BluffManager) {
    const options = new OptionsReader<BluffOptions>(manager, BluffOptionsSchema, DEFAULT_OPTIONS);
    this.clock = new PhaseClock(manager, () => options.current.votingSeconds);
  }

  get prompt(): string {
    return this.manager.state?.promptText ?? "";
  }

  get roundLabel(): string {
    const state = this.manager.state;
    return `Round ${state?.roundNumber ?? 0} of ${state?.totalRounds ?? 0}`;
  }

  /** The options in their shuffled order; authorship is never synced. */
  get choices(): ChoiceRow[] {
    const state = this.manager.state;
    if (state === undefined) return [];
    const mineId = state.mine.get(this.manager.playerId)?.myOptionId ?? "";
    return [...state.choices].map((choice) => ({
      id: choice.id,
      text: choice.text,
      isMine: choice.id === mineId,
    }));
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

  get totalSeconds(): number {
    return this.clock.totalSeconds;
  }

  get announcement(): string {
    return this.clock.announcement;
  }

  async vote(optionId: string): Promise<void> {
    const result = await this.manager.sendAction(ACTION.CAST_VOTE, { optionId });
    if (result.ok) this.voted = true;
  }
}
