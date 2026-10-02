import type { GameConnectionManager } from "@partygame/game-client";
import { NAME_MAX_LENGTH } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";

/** A text draft that tells the server the name after a pause in typing. */
export class NameField<TState extends BaseGameState = BaseGameState> {
  draft = $state("");
  private timer: ReturnType<typeof setTimeout> | undefined;

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
    if (!trimmed) return;
    this.timer = setTimeout(
      () => this.manager.setName(trimmed.slice(0, NAME_MAX_LENGTH)),
      this.debounceMs,
    );
  }

  destroy(): void {
    clearTimeout(this.timer);
  }
}
