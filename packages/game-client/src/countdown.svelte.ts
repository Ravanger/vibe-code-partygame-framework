const DEFAULT_TICK_MS = 250;

export class Countdown {
  // All reactive fields are assigned in the constructor (not as field initializers): Svelte
  // compiles `$state`/`$derived` class fields differently for client and server, and v8 coverage
  // merges per-project maps by source location — a project that loads this file with one mode but
  // never constructs it would leave phantom uncovered lines behind. Constructor assignments
  // compile identically in both modes.
  private now: number;
  private readonly interval: ReturnType<typeof setInterval>;
  private lastServerNow = 0;
  private lastServerNowClientTime = 0;
  readonly secondsLeft: number;
  readonly isExpired: boolean;
  readonly isUrgent: boolean;

  constructor(
    private readonly getEndsAt: () => number,
    private readonly getServerNowFn: () => number,
    tickMs = DEFAULT_TICK_MS,
  ) {
    this.now = $state(Date.now());
    this.lastServerNow = this.getServerNowFn();
    // Must be the same instant as `now`; a second Date.now() read here can land a
    // millisecond later, making elapsedSinceServer negative and rounding secondsLeft up.
    this.lastServerNowClientTime = this.now;
    this.interval = setInterval(() => {
      this.now = Date.now();
      const newServerNow = this.getServerNowFn();
      if (newServerNow !== this.lastServerNow) {
        this.lastServerNow = newServerNow;
        this.lastServerNowClientTime = this.now;
      }
    }, tickMs);
    this.secondsLeft = $derived.by(() => {
      const ends = this.getEndsAt();
      const serverNow = this.getServerNowFn();
      if (!ends || !serverNow) return 0;
      if (serverNow !== this.lastServerNow) {
        this.lastServerNow = serverNow;
        this.lastServerNowClientTime = this.now;
      }
      const elapsedSinceServer = this.now - this.lastServerNowClientTime;
      const estimatedServerNow = this.lastServerNow + elapsedSinceServer;
      return Math.max(0, Math.ceil((ends - estimatedServerNow) / 1000));
    });
    this.isExpired = $derived(this.secondsLeft <= 0);
    this.isUrgent = $derived(this.secondsLeft > 0 && this.secondsLeft <= 10);
  }

  destroy() {
    clearInterval(this.interval);
  }
}
