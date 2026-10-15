const DEFAULT_IDLE_MS = 2500;

/** Tells the server when this player starts and stops typing: one message per change, never per keystroke. */
export class TypingReporter {
  private typing = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly send: (typing: boolean) => void,
    private readonly idleMs = DEFAULT_IDLE_MS,
  ) {}

  /** Call on every keystroke: reports "typing" once and restarts the idle timer. */
  keystroke(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.stop(), this.idleMs);
    if (this.typing) return;
    this.typing = true;
    this.send(true);
  }

  /** Reports "stopped" once; does nothing when not typing. */
  stop(): void {
    clearTimeout(this.timer);
    if (!this.typing) return;
    this.typing = false;
    this.send(false);
  }
}
