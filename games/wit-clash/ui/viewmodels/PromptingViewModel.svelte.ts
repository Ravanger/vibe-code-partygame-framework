import type { GameConnectionManager } from "@partygame/game-client/connection";
import { Countdown } from "@partygame/game-client/countdown";

interface PromptingState {
  answersSubmitted: number;
  answersExpected: number;
  phaseEndsAt: number;
  serverNow: number;
}

export class PromptingViewModel {
  myPrompts = $state<Array<{ matchupId: string; promptText: string }>>([]);
  currentIndex = $state(0);
  private drafts = $state<Record<string, string>>({});
  submitted = $state<Record<string, boolean>>({});
  readonly countdown: Countdown;

  constructor(private readonly manager: GameConnectionManager) {
    this.countdown = new Countdown(
      () => this.state?.phaseEndsAt ?? 0,
      () => this.state?.serverNow ?? 0,
    );
    manager.room?.onMessage("YOUR_PROMPTS", (list: any) => {
      this.myPrompts = list;
    });
  }

  private readonly state = $derived(
    this.manager.stateVersion >= 0
      ? (this.manager.room?.state as PromptingState | undefined)
      : undefined,
  );

  readonly current = $derived(this.myPrompts[this.currentIndex]);
  readonly draft = $derived(this.current ? (this.drafts[this.current.matchupId] ?? "") : "");
  readonly charsRemaining = $derived(200 - this.draft.length);
  readonly canSubmit = $derived(this.draft.trim().length > 0 && this.draft.length <= 200);
  readonly allSubmitted = $derived(
    this.myPrompts.length > 0 && this.myPrompts.every((p) => this.submitted[p.matchupId]),
  );
  readonly progress = $derived(
    `${this.state?.answersSubmitted ?? 0} of ${this.state?.answersExpected ?? 0} answers in`,
  );

  setDraft(v: string) {
    if (this.current) this.drafts[this.current.matchupId] = v;
  }

  submit() {
    if (!this.canSubmit || !this.current) return;
    const matchupId = this.current.matchupId;
    this.manager.room?.send("ACTION", {
      type: "SUBMIT_ANSWER",
      matchupId,
      answer: this.draft.trim(),
    });
    this.submitted[matchupId] = true;
    if (this.currentIndex < this.myPrompts.length - 1) this.currentIndex += 1;
  }

  goTo(i: number) {
    this.currentIndex = Math.max(0, Math.min(i, this.myPrompts.length - 1));
  }

  destroy() {
    this.countdown.destroy();
  }
}
