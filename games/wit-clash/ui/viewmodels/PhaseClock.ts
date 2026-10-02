import type { Countdown } from "@partygame/game-client";
import { DEFAULT_OPTIONS, type WitClashOptions, WitClashOptionsSchema } from "../../src/options.js";
import type { WitClashManager } from "../manager.js";

export type DurationOption = {
  [K in keyof WitClashOptions]: K extends `${string}Seconds` ? K : never;
}[keyof WitClashOptions];

const ANNOUNCE_AT = [30, 10, 5];

/** The server's countdown of the current phase, plus how long that phase was set to run. */
export class PhaseClock {
  private readonly countdown: Countdown;

  constructor(
    private readonly manager: WitClashManager,
    private readonly option: DurationOption,
  ) {
    this.countdown = manager.countdown();
  }

  get secondsLeft(): number {
    return this.countdown.secondsLeft;
  }

  get isUrgent(): boolean {
    return this.countdown.isUrgent;
  }

  get announcement(): string {
    return ANNOUNCE_AT.includes(this.secondsLeft) ? `${this.secondsLeft} seconds remaining` : "";
  }

  get totalSeconds(): number {
    const parsed = WitClashOptionsSchema.safeParse(this.published());
    return (parsed.success ? parsed.data : DEFAULT_OPTIONS)[this.option];
  }

  destroy(): void {
    this.countdown.destroy();
  }

  private published(): unknown {
    try {
      return JSON.parse(this.manager.state?.options ?? "{}");
    } catch {
      return {};
    }
  }
}
