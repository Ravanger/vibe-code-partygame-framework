import type { GameConnectionManager } from "@partygame/game-client/connection";
import { Countdown } from "@partygame/game-client/countdown";

interface PromptingState {
  answersSubmitted: number;
  answersExpected: number;
  phaseEndsAt: number;
  serverNow: number;
}

export class PromptingViewModel {
  // Sourced from the manager (layer 1), which captures the one-shot
  // YOUR_PROMPTS message at connect time — see connection.svelte.ts.
  // Getter, not a field: field initializers run before `manager` is assigned
  // (TS2729), and the manager's $state field is tracked through the read.
  get myPrompts(): Array<{ matchupId: string; promptText: string }> {
    return this.manager.myPrompts;
  }
  currentIndex = $state(0);
  private drafts = $state<Record<string, string>>({});
  submitted = $state<Record<string, boolean>>({});

  // Getter, not $derived — same-referenced room.state is swallowed by Svelte's equality gate
  // (see WaitingRoomViewModel for the full rationale).
  private get state(): PromptingState | undefined {
    return this.manager.stateVersion >= 0
      ? (this.manager.room?.state as PromptingState | undefined)
      : undefined;
  }

  readonly countdown: Countdown;

  constructor(private readonly manager: GameConnectionManager) {
    this.countdown = new Countdown(
      () => this.state?.phaseEndsAt ?? 0,
      () => this.state?.serverNow ?? 0,
    );
  }

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
