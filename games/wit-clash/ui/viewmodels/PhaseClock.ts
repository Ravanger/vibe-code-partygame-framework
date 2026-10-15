import type { Countdown } from "@partygame/game-client";
import { OptionsReader } from "@partygame/game-ui";
import { DEFAULT_OPTIONS, type WitClashOptions, WitClashOptionsSchema } from "../../src/options.js";
import type { WitClashManager } from "../manager.js";

export type DurationOption = {
  [K in keyof WitClashOptions]: K extends `${string}Seconds` ? K : never;
}[keyof WitClashOptions];

const ANNOUNCE_AT = [30, 10, 5];

/** The server's countdown of the current phase, plus how long that phase was set to run. */
export class PhaseClock {
  private readonly countdown: Countdown;
  private readonly options: OptionsReader<WitClashOptions>;

  constructor(
    manager: WitClashManager,
    private readonly option: DurationOption,
  ) {
    this.countdown = manager.countdown();
    this.options = new OptionsReader(manager, WitClashOptionsSchema, DEFAULT_OPTIONS);
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
    return this.options.current[this.option];
  }

  destroy(): void {
    this.countdown.destroy();
  }
}
