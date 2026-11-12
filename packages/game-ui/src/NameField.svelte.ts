import type { GameConnectionManager } from "@partygame/game-client";
import { NAME_MAX_LENGTH } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";

/** A text draft that tells the server the name after a pause in typing; an unflushed rename is sent on destroy. */
export class NameField<TState extends BaseGameState = BaseGameState> {
  draft = $state("");
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: string | undefined;

  constructor(
    private readonly manager: GameConnectionManager<TState>,
    private readonly debounceMs = 250,
  ) {
    this.draft = manager.me()?.name ?? "";
  }

  /** The draft updates at once; the server hears one message per burst of typing. */
  set(value: string): void {
    this.draft = value;
    clearTimeout(this.timer);
    const trimmed = value.trim();
    if (!trimmed) {
      this.pending = undefined;
      return;
    }
    // Spread iterates code points, so the cap counts one emoji as one character and never
    // splits a surrogate pair.
    this.pending = [...trimmed].slice(0, NAME_MAX_LENGTH).join("");
    this.timer = setTimeout(() => this.sendPending(), this.debounceMs);
  }

  private sendPending(): void {
    const name = this.pending;
    if (name === undefined) return;
    this.pending = undefined;
    this.manager.setName(name);
  }

  /** Sends a pending debounced rename once, so an unmount right after typing does not lose the name. */
  destroy(): void {
    clearTimeout(this.timer);
    this.sendPending();
  }
}
