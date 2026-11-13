import type { GameConnectionManager } from "@partygame/game-client";
import type { BaseGameState } from "@partygame/shared/schema";
import type { Snippet } from "svelte";

/** Browser storage the sheet's seen flag persists to (e.g. `localStorage`); every access is wrapped, so a throwing or blocked storage (private windows) degrades to opening once per page load. @experimental How-to-play API; may change before 1.0. */
export interface HowToPlayStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Timer used for the carousel's auto-advance; inject a fake in tests. @experimental How-to-play API; may change before 1.0. */
export interface HowToPlayTimer {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
}

/** Options for {@link HowToPlayViewModel}. @experimental How-to-play API; may change before 1.0. */
export interface HowToPlayViewModelOptions {
  /** Where the seen flag persists. */
  storage: HowToPlayStorage;
  /** The game's `storagePrefix`; the flag is stored under `${storagePrefix}.howToPlaySeen`. */
  storagePrefix: string;
  /** The carousel's auto-advance cadence in milliseconds (default 8000). */
  intervalMs?: number;
  /** Timer implementation (default: the global one). */
  timer?: HowToPlayTimer;
}

/**
 * One step of a how-to-play sheet. A step must read without its snippets: `title` and `body`
 * carry the content, `illustration` and `example` are optional additions the game draws.
 * @experimental How-to-play API; may change before 1.0.
 */
export interface HowToPlayStep {
  /** The step's heading. */
  title: string;
  /** The step's text. */
  body: string;
  /** An optional illustration drawn by the game. */
  illustration?: Snippet;
  /** An optional worked example drawn by the game. */
  example?: Snippet;
}

const DEFAULT_INTERVAL_MS = 8000;
const SEEN_VALUE = "1";

const defaultTimer: HowToPlayTimer = {
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (id) => clearInterval(id as number),
};

/**
 * The open state, step index, once-per-browser auto-open and the seatless carousel timer of a
 * how-to-play sheet. Games construct one with `untrack` and share it between the `HowToPlay`
 * sheet and any number of `HowToPlayButton`s.
 * @experimental How-to-play API; may change before 1.0.
 */
export class HowToPlayViewModel {
  /** Whether the dialog sheet is open. */
  open = $state(false);
  /** Zero-based index of the current step; navigation wraps around within `stepCount()`. */
  stepIndex = $state(0);

  private readonly intervalMs: number;
  private readonly timer: HowToPlayTimer;
  private stopped = false;
  private handle: unknown = null;

  /**
   * @param manager the connection (the sheet runs as a carousel when the viewer has no seat)
   * @param options where the seen flag persists and the carousel's cadence
   * @param stepCount how many steps the game renders (read live, so a changing list stays in sync)
   */
  constructor(
    private readonly manager: GameConnectionManager<BaseGameState>,
    private readonly options: HowToPlayViewModelOptions,
    private readonly stepCount: () => number = () => 0,
  ) {
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.timer = options.timer ?? defaultTimer;
  }

  /** True while the viewer has no seat (the TV display). */
  get isSpectator(): boolean {
    return this.manager.isSpectator;
  }

  /** Opens the sheet and marks it seen for this browser; a no-op without steps. */
  openSheet(): void {
    if (this.stepCount() === 0) return;
    this.open = true;
    this.markSeen();
  }

  /** Closes the sheet. */
  closeSheet(): void {
    this.open = false;
  }

  /**
   * Opens the sheet once per browser: a no-op when this browser already saw it (the flag under
   * `${storagePrefix}.howToPlaySeen`) or there are no steps. A throwing or blocked storage never
   * throws and degrades to "not seen", so the sheet opens once per page load.
   */
  autoOpen(): void {
    if (this.hasSeen()) return;
    this.openSheet();
  }

  /** Steps to the next step, wrapping to the first; a no-op without steps. */
  next(): void {
    this.move(1);
  }

  /** Steps to the previous step, wrapping to the last; a no-op without steps. */
  previous(): void {
    this.move(-1);
  }

  /** Jumps to step `index`, wrapping out-of-range values; a no-op without steps. */
  goTo(index: number): void {
    const count = this.stepCount();
    if (count === 0) return;
    this.stepIndex = ((index % count) + count) % count;
  }

  /** True while the carousel auto-advance is running. */
  get carouselRunning(): boolean {
    return this.handle !== null;
  }

  /**
   * Starts the carousel's auto-advance every `intervalMs`; a no-op while already running, after
   * user input stopped it, or with at most one step.
   */
  startCarousel(): void {
    if (this.stopped || this.handle !== null || this.stepCount() <= 1) return;
    this.handle = this.timer.setInterval(() => this.next(), this.intervalMs);
  }

  /** Stops the carousel's auto-advance for good — call it on user input. */
  stopCarousel(): void {
    this.stopped = true;
    this.clear();
  }

  /** Stops the carousel without the permanent flag, e.g. when the screen unmounts. */
  pauseCarousel(): void {
    this.clear();
  }

  private move(delta: number): void {
    const count = this.stepCount();
    if (count === 0) return;
    this.stepIndex = (this.stepIndex + delta + count) % count;
  }

  private get seenKey(): string {
    return `${this.options.storagePrefix}.howToPlaySeen`;
  }

  private hasSeen(): boolean {
    try {
      return this.options.storage.getItem(this.seenKey) === SEEN_VALUE;
    } catch {
      return false;
    }
  }

  private markSeen(): void {
    try {
      this.options.storage.setItem(this.seenKey, SEEN_VALUE);
    } catch {}
  }

  private clear(): void {
    if (this.handle !== null) {
      this.timer.clearInterval(this.handle);
      this.handle = null;
    }
  }
}
