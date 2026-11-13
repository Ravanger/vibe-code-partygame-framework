import {
  OptionsReader,
  PhaseClock,
  roundLabel,
  TextDraft,
  TypingReporter,
} from "@partygame/game-ui";
import { ACTION, ANSWER_MAX_LENGTH } from "../../src/actionNames.js";
import type { SubmitAnswerPayload } from "../../src/actions.js";
import { DEFAULT_OPTIONS, type WitClashOptions, WitClashOptionsSchema } from "../../src/options.js";
import type { WitClashManager } from "../manager.js";
import { AnswerProgress } from "./AnswerProgress.js";

export interface PromptView {
  matchupId: string;
  promptText: string;
  submitted: boolean;
}

export class PromptingViewModel {
  currentIndex = $state(0);
  private editing = $state(false);
  private readonly drafts: TextDraft;
  private readonly clock: PhaseClock;
  private readonly typing: TypingReporter;
  private readonly options: OptionsReader<WitClashOptions>;
  readonly progress: AnswerProgress;

  constructor(private readonly manager: WitClashManager) {
    this.options = new OptionsReader<WitClashOptions>(
      manager,
      WitClashOptionsSchema,
      DEFAULT_OPTIONS,
    );
    this.drafts = new TextDraft(manager, {
      maxLength: ANSWER_MAX_LENGTH,
      filterLevel: () => this.options.current.filterLevel,
      rejectedCount: () => manager.state?.rejectedTexts,
      noun: "answer",
    });
    this.clock = new PhaseClock(manager, () => this.options.current.promptSeconds);
    this.typing = new TypingReporter((typing) => {
      void this.manager.sendAction(ACTION.SET_TYPING, { typing });
    });
    this.progress = new AnswerProgress(manager);
  }

  get isSpectator(): boolean {
    return this.manager.isSpectator;
  }

  get prompts(): PromptView[] {
    const mine = this.manager.state?.mine.get(this.manager.playerId);
    return [...(mine?.prompts ?? [])].map((p) => ({
      matchupId: p.matchupId,
      promptText: p.promptText,
      submitted: p.submitted,
    }));
  }

  get isSittingOut(): boolean {
    return !this.isSpectator && this.prompts.length === 0;
  }

  get categoryLabel(): string {
    const state = this.manager.state;
    const category = [...(state?.categoryOptions ?? [])].find(
      (option) => option.id === state?.selectedCategory,
    );
    return category ? `${category.emoji} ${category.name}` : "";
  }

  get current(): PromptView | undefined {
    return this.prompts[this.currentIndex];
  }

  private get currentKey(): string {
    return this.current?.matchupId ?? "";
  }

  get draft(): string {
    return this.drafts.draft(this.currentKey);
  }

  get charsRemaining(): number {
    return this.drafts.charsRemaining(this.currentKey);
  }

  get canSubmit(): boolean {
    return this.drafts.canSubmit(this.currentKey);
  }

  get allSubmitted(): boolean {
    const { prompts } = this;
    return prompts.length > 0 && prompts.every((p) => p.submitted);
  }

  get showForm(): boolean {
    return !this.allSubmitted || this.editing;
  }

  get rejectionReason(): string {
    return this.drafts.rejectionReason;
  }

  get moderationLine(): string {
    return this.drafts.moderationLine;
  }

  get answersIn(): number {
    return [...(this.manager.state?.progress.values() ?? [])].reduce((sum, n) => sum + n, 0);
  }

  get answersExpected(): number {
    const state = this.manager.state;
    return (state?.progress.size ?? 0) * (state?.answersPerPlayer ?? 0);
  }

  get roundLabel(): string {
    const state = this.manager.state;
    return roundLabel(state?.roundNumber ?? 0, state?.totalRounds ?? 0);
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

  setDraft(value: string): void {
    const { current } = this;
    if (!current) return;
    this.drafts.setDraft(current.matchupId, value);
    this.typing.keystroke();
  }

  async submit(): Promise<void> {
    const { current } = this;
    if (!this.canSubmit || !current) return;
    this.typing.stop();
    const payload: SubmitAnswerPayload = {
      matchupId: current.matchupId,
      answer: this.draft.trim(),
    };
    const result = await this.manager.sendAction(ACTION.SUBMIT_ANSWER, payload);
    if (!result.ok) return;
    // The rejection is answered: clear the reason and the toast it drove.
    this.manager.dismissError();
    if (this.currentIndex < this.prompts.length - 1) ++this.currentIndex;
    else this.editing = false;
  }

  startEditing(): void {
    this.currentIndex = 0;
    this.editing = true;
  }

  goTo(index: number): void {
    this.currentIndex = Math.max(0, Math.min(index, this.prompts.length - 1));
  }

  destroy(): void {
    this.typing.stop();
  }
}
