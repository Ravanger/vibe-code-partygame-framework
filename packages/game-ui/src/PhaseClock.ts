import type { Countdown, GameConnectionManager } from "@partygame/game-client";
import type { BaseGameState } from "@partygame/shared/schema";
import { getStrings } from "./strings.js";

const ANNOUNCE_AT = [30, 10, 5];

/** The server's countdown of the current phase, plus how long that phase was set to run. */
export class PhaseClock {
  private readonly countdown: Countdown;

  constructor(
    manager: GameConnectionManager<BaseGameState>,
    private readonly readTotalSeconds: () => number,
    private readonly announceAt: readonly number[] = ANNOUNCE_AT,
  ) {
    this.countdown = manager.countdown();
  }

  /** Whole seconds left in the phase, on the server's clock. */
  get secondsLeft(): number {
    return this.countdown.secondsLeft;
  }

  /** True in the last ten seconds of the phase. */
  get isUrgent(): boolean {
    return this.countdown.isUrgent;
  }

  /** The table's `secondsRemaining` text at the announcement thresholds, otherwise "". */
  get announcement(): string {
    const left = this.secondsLeft;
    return this.announceAt.includes(left) ? getStrings().secondsRemaining(left) : "";
  }

  /** How long the phase was set to run, in whole seconds. */
  get totalSeconds(): number {
    return this.readTotalSeconds();
  }

  /** The share of the phase still running, from 0 to 1; 0 when the phase has no length. */
  get fraction(): number {
    const total = this.totalSeconds;
    return total > 0 ? Math.min(1, Math.max(0, this.secondsLeft / total)) : 0;
  }
}
