import { ACTION, ANSWER_MAX_LENGTH } from "../../src/actionNames.js";
import type { SubmitAnswerPayload } from "../../src/actions.js";
import type { WitClashManager } from "../manager.js";
import { AnswerProgress } from "./AnswerProgress.js";
import { PhaseClock } from "./PhaseClock.js";
import { TypingReporter } from "./TypingReporter.js";

export interface PromptView {
  matchupId: string;
  promptText: string;
  submitted: boolean;
}

export class PromptingViewModel {
  currentIndex = $state(0);
  private editing = $state(false);
  private readonly drafts = $state<Record<string, string>>({});
  private readonly clock: PhaseClock;
  private readonly typing: TypingReporter;
  readonly progress: AnswerProgress;

  constructor(private readonly manager: WitClashManager) {
    this.clock = new PhaseClock(manager, "promptSeconds");
    this.typing = new TypingReporter(manager);
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

  get draft(): string {
    return this.drafts[this.current?.matchupId ?? ""] ?? "";
  }

  get charsRemaining(): number {
    return ANSWER_MAX_LENGTH - this.draft.length;
  }

  get canSubmit(): boolean {
    return this.draft.trim().length > 0 && this.draft.length <= ANSWER_MAX_LENGTH;
  }

  get allSubmitted(): boolean {
    const { prompts } = this;
    return prompts.length > 0 && prompts.every((p) => p.submitted);
  }

  get showForm(): boolean {
    return !this.allSubmitted || this.editing;
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

  setDraft(value: string): void {
    const { current } = this;
    if (!current) return;
    this.drafts[current.matchupId] = value;
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
    this.clock.destroy();
  }
}
