import { ACTION } from "../../src/actionNames.js";
import type { SetTypingPayload } from "../../src/actions.js";
import type { WitClashManager } from "../manager.js";

const TYPING_IDLE_MS = 2500;

/** Tells the server when this player starts and stops typing: one message per change, never per keystroke. */
export class TypingReporter {
  private typing = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly manager: WitClashManager) {}

  keystroke(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.stop(), TYPING_IDLE_MS);
    if (this.typing) return;
    this.typing = true;
    this.report(true);
  }

  stop(): void {
    clearTimeout(this.timer);
    if (!this.typing) return;
    this.typing = false;
    this.report(false);
  }

  private report(typing: boolean): void {
    const payload: SetTypingPayload = { typing };
    void this.manager.sendAction(ACTION.SET_TYPING, payload);
  }
}
