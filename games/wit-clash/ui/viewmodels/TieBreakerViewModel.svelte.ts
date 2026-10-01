import type { Countdown } from "@partygame/game-client";
import { ACTION, ANSWER_MAX_LENGTH } from "../../src/actionNames.js";
import type { CastVotePayload, SubmitAnswerPayload } from "../../src/actions.js";
import type { Matchup } from "../../src/state.js";
import type { WitClashManager } from "../manager.js";
import { AnswerProgress } from "./AnswerProgress.js";
import { MatchupRecap, type RevealedMatchup } from "./MatchupRecap.js";
import { TypingReporter } from "./TypingReporter.js";

export interface TieBreakerChoice {
  id: string;
  text: string;
  isMine: boolean;
}

/** The final tie-breaker: contenders answer, everyone else votes, then the result is shown. */
export class TieBreakerViewModel {
  private draftText = $state("");
  private readonly countdown: Countdown;
  private readonly recap: MatchupRecap;
  private readonly typing: TypingReporter;
  readonly progress: AnswerProgress;

  constructor(private readonly manager: WitClashManager) {
    this.countdown = manager.countdown();
    this.recap = new MatchupRecap(manager);
    this.typing = new TypingReporter(manager);
    this.progress = new AnswerProgress(manager);
  }

  private get matchup(): Matchup | undefined {
    const rounds = this.manager.state?.tieBreakers;
    return rounds?.[rounds.length - 1];
  }

  private get mine() {
    return this.manager.state?.mine.get(this.manager.playerId);
  }

  get promptText(): string {
    return this.matchup?.promptText ?? "";
  }

  get contenderNames(): string[] {
    const state = this.manager.state;
    return [...(state?.tieBreakerContenders ?? [])].map((id) => state?.players.get(id)?.name ?? "");
  }

  get isContender(): boolean {
    return this.manager.state?.tieBreakerContenders.includes(this.manager.playerId) ?? false;
  }

  get draft(): string {
    return this.draftText;
  }

  get charsRemaining(): number {
    return ANSWER_MAX_LENGTH - this.draftText.length;
  }

  get canSubmit(): boolean {
    return this.draftText.trim().length > 0 && this.draftText.length <= ANSWER_MAX_LENGTH;
  }

  get hasSubmitted(): boolean {
    return this.mine?.prompts[0]?.submitted ?? false;
  }

  get choices(): TieBreakerChoice[] {
    const picked = this.mine?.matchupVote;
    return [...(this.matchup?.answers ?? [])].map((a) => ({
      id: a.id,
      text: a.text,
      isMine: a.id === picked,
    }));
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

  get revealed(): RevealedMatchup | undefined {
    const matchup = this.matchup;
    if (!matchup?.isRevealed) return undefined;
    return this.recap.describe(matchup);
  }

  get secondsLeft(): number {
    return this.countdown.secondsLeft;
  }

  get isUrgent(): boolean {
    return this.countdown.isUrgent;
  }

  setDraft(value: string): void {
    this.draftText = value;
    this.typing.keystroke();
  }

  async submit(): Promise<void> {
    const matchup = this.matchup;
    if (!this.canSubmit || !matchup) return;
    this.typing.stop();
    const payload: SubmitAnswerPayload = { matchupId: matchup.id, answer: this.draftText.trim() };
    await this.manager.sendAction(ACTION.SUBMIT_ANSWER, payload);
  }

  async vote(answerId: string): Promise<void> {
    const payload: CastVotePayload = { answerId };
    if (this.canVote) await this.manager.sendAction(ACTION.CAST_VOTE, payload);
  }

  destroy(): void {
    this.typing.stop();
    this.countdown.destroy();
  }
}
