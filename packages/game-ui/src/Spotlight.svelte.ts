/**
 * The index of a set of panels that take turns in the spotlight: it advances one step every
 * `periodMs` and wraps around while more than one panel exists; with a single panel it stays at
 * zero. Call `destroy()` when the screen unmounts to stop the timer.
 */
export class Spotlight {
  /** The index of the panel currently in the spotlight. */
  current = $state(0);
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly count: () => number,
    periodMs = 8000,
  ) {
    this.timer = setInterval(() => this.advance(), periodMs);
  }

  /** True while more than one panel exists and the index is rotating. */
  get isActive(): boolean {
    return this.count() > 1;
  }

  /** Stops the rotation timer. */
  destroy(): void {
    clearInterval(this.timer);
  }

  private advance(): void {
    this.current = this.isActive ? (this.current + 1) % this.count() : 0;
  }
}
