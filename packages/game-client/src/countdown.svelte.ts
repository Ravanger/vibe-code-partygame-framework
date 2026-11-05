import { createSubscriber } from "svelte/reactivity";

const DEFAULT_TICK_MS = 250;

// `$state` stays in a closure: assigning it in a constructor body does not compile.
function createNow() {
  let now = $state(Date.now());
  return {
    get value(): number {
      return now;
    },
    set value(next: number) {
      now = next;
    },
  };
}

/** Seconds left until a server-set deadline, corrected for client clock skew, with `isExpired` and `isUrgent` flags. */
export class Countdown {
  private readonly nowRef = createNow();
  private lastServerNow = 0;
  private lastServerNowClientTime = 0;
  readonly isExpired: boolean = $derived(this.secondsLeft <= 0);
  readonly isUrgent: boolean = $derived(this.secondsLeft > 0 && this.secondsLeft <= 10);
  private readonly track: () => void;

  constructor(
    private readonly getEndsAt: () => number,
    private readonly getServerNowFn: () => number,
    tickMs = DEFAULT_TICK_MS,
  ) {
    this.lastServerNow = this.getServerNowFn();
    // Reuse `nowRef.value`: a second Date.now() can land later and round secondsLeft up.
    this.lastServerNowClientTime = this.nowRef.value;
    this.track = createSubscriber((update) => {
      const interval = setInterval(() => {
        this.tick();
        update();
      }, tickMs);
      return () => clearInterval(interval);
    });
  }

  /** Whole seconds left, skew-corrected against the last server time seen; `0` when no timer is set. */
  get secondsLeft(): number {
    this.track();
    const ends = this.getEndsAt();
    const serverNow = this.getServerNowFn();
    const isNewer = serverNow !== 0 && serverNow !== this.lastServerNow;
    const anchor = isNewer ? serverNow : this.lastServerNow;
    if (!ends || !anchor) return 0;
    const elapsedSinceServer = isNewer ? 0 : this.nowRef.value - this.lastServerNowClientTime;
    const estimatedServerNow = anchor + elapsedSinceServer;
    return Math.max(0, Math.ceil((ends - estimatedServerNow) / 1000));
  }

  /** Advances the client clock and re-anchors to a newer server time. */
  private tick(): void {
    this.nowRef.value = Date.now();
    const newServerNow = this.getServerNowFn();
    if (newServerNow !== this.lastServerNow) {
      this.lastServerNow = newServerNow;
      this.lastServerNowClientTime = this.nowRef.value;
    }
  }

  /**
   * No-op kept for compatibility.
   * @deprecated The interval now starts and stops with the readers, so this no longer does anything.
   */
  destroy(): void {}
}
