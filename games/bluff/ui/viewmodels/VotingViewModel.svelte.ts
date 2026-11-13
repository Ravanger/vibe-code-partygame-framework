import { OptionsReader, PhaseClock, roundLabel } from "@partygame/game-ui";
import { ACTION } from "../../src/actionNames.js";
import { type BluffOptions, BluffOptionsSchema, DEFAULT_OPTIONS } from "../../src/options.js";
import type { BluffManager } from "../manager.js";

export interface ChoiceRow {
  id: string;
  text: string;
  own: boolean;
  picked: boolean;
}

/** The shuffled options, the private "this one is yours" mark and the vote action. */
export class VotingViewModel {
  readonly clock: PhaseClock;

  constructor(private readonly manager: BluffManager) {
    const options = new OptionsReader<BluffOptions>(manager, BluffOptionsSchema, DEFAULT_OPTIONS);
    this.clock = new PhaseClock(manager, () => options.current.votingSeconds);
  }

  get prompt(): string {
    return this.manager.state?.promptText ?? "";
  }

  get roundLabel(): string {
    const state = this.manager.state;
    return roundLabel(state?.roundNumber ?? 0, state?.totalRounds ?? 0);
  }

  /** The options in their shuffled order, with the private marks for the board. */
  get choices(): ChoiceRow[] {
    const state = this.manager.state;
    if (state === undefined) return [];
    const mine = state.mine.get(this.manager.playerId);
    return [...state.choices].map((choice) => ({
      id: choice.id,
      text: choice.text,
      own: choice.id === (mine?.myOptionId ?? ""),
      picked: choice.id === (mine?.myVote ?? ""),
    }));
  }

  /** True once the server has recorded this client's vote for the current round; survives a reload. */
  get voted(): boolean {
    return (this.manager.state?.mine.get(this.manager.playerId)?.myVote ?? "") !== "";
  }

  get votesCast(): number {
    return this.manager.state?.votesCast ?? 0;
  }

  get votesExpected(): number {
    return this.manager.state?.votesExpected ?? 0;
  }

  /** Casts this client's vote; the synced private state reports it through {@link voted}. */
  async vote(optionId: string): Promise<void> {
    await this.manager.sendAction(ACTION.CAST_VOTE, { optionId });
  }
}
