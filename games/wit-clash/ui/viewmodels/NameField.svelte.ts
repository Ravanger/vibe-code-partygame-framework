import type { WitClashManager } from "../manager.js";

const NAME_DEBOUNCE_MS = 250;
const NAME_MAX_LENGTH = 20;

export class NameField {
  draft = $state("");
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly manager: WitClashManager) {
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
      NAME_DEBOUNCE_MS,
    );
  }

  destroy(): void {
    clearTimeout(this.timer);
  }
}
