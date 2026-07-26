const DEFAULT_TICK_MS = 250;

export class Countdown {
  private now = $state(Date.now());
  private readonly interval: ReturnType<typeof setInterval>;
  private lastServerNow = 0;
  private lastServerNowClientTime = 0;

  constructor(
    private readonly getEndsAt: () => number,
    private readonly getServerNowFn: () => number,
    tickMs = DEFAULT_TICK_MS,
  ) {
    this.lastServerNow = this.getServerNowFn();
    this.lastServerNowClientTime = Date.now();
    this.interval = setInterval(() => {
      this.now = Date.now();
      const newServerNow = this.getServerNowFn();
      if (newServerNow !== this.lastServerNow) {
        this.lastServerNow = newServerNow;
        this.lastServerNowClientTime = this.now;
      }
    }, tickMs);
  }

  readonly secondsLeft = $derived.by(() => {
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

  readonly isExpired = $derived(this.secondsLeft <= 0);

  readonly isUrgent = $derived(this.secondsLeft > 0 && this.secondsLeft <= 10);

  destroy() {
    clearInterval(this.interval);
  }
}
