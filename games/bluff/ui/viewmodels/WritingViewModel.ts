import { OptionsReader, PhaseClock } from "@partygame/game-ui";
import { ACTION } from "../../src/actionNames.js";
import { type BluffOptions, BluffOptionsSchema, DEFAULT_OPTIONS } from "../../src/options.js";
import type { BluffManager } from "../manager.js";

export interface WriterRow {
  id: string;
  name: string;
  done: boolean;
  isMe: boolean;
}

/** The prompt, who has written, the server's clock and the submit action. */
export class WritingViewModel {
  private readonly clock: PhaseClock;

  constructor(private readonly manager: BluffManager) {
    const options = new OptionsReader<BluffOptions>(manager, BluffOptionsSchema, DEFAULT_OPTIONS);
    this.clock = new PhaseClock(manager, () => options.current.writingSeconds);
  }

  get prompt(): string {
    return this.manager.state?.promptText ?? "";
  }

  get roundLabel(): string {
    const state = this.manager.state;
    return `Round ${state?.roundNumber ?? 0} of ${state?.totalRounds ?? 0}`;
  }

  /** One row per seated player, in seat order. */
  get rows(): WriterRow[] {
    const state = this.manager.state;
    if (state === undefined) return [];
    return [...state.players.values()].map((seat) => ({
      id: seat.id,
      name: seat.name,
      done: state.progress.get(seat.id) === true,
      isMe: seat.id === this.manager.playerId,
    }));
  }

  get myDone(): boolean {
    return this.manager.state?.progress.get(this.manager.playerId) === true;
  }

  get secondsLeft(): number {
    return this.clock.secondsLeft;
  }

  get totalSeconds(): number {
    return this.clock.totalSeconds;
  }

  get announcement(): string {
    return this.clock.announcement;
  }

  async submit(text: string): Promise<void> {
    await this.manager.sendAction(ACTION.SUBMIT_FAKE, { text });
  }
}
