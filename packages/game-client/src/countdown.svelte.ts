import { createSubscriber } from "svelte/reactivity";

const DEFAULT_TICK_MS = 250;

// The client clock lives in a closure instead of a class field: Stryker wraps constructor
// statements in if/else, so `$state` cannot be assigned in the constructor (Svelte accepts it
// only as a top-level constructor assignment), and a `$state` class field initializer leaves
// phantom uncovered items when v8 merges per-project maps. A local declaration inside a
// function body compiles identically in every mode and survives instrumentation.
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
    // Must be the same instant as `nowRef.value`; a second Date.now() read here can land a
    // millisecond later, making elapsedSinceServer negative and rounding secondsLeft up.
    this.lastServerNowClientTime = this.nowRef.value;
    // The interval runs only while an effect reads `secondsLeft`: the first reader starts it,
    // the last one going away clears it. Plain (non-reactive) reads compute once, no interval.
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

  /** @deprecated The interval now starts and stops with the readers, so this no longer does anything. */
  destroy(): void {}
}
