import { OptionsReader, PhaseClock, type ProgressRow, roundLabel } from "@partygame/game-ui";
import { ErrorCode } from "@partygame/shared";
import { ACTION } from "../../src/actionNames.js";
import { type BluffOptions, BluffOptionsSchema, DEFAULT_OPTIONS } from "../../src/options.js";
import type { BluffManager } from "../manager.js";

/** The prompt, who has written, the server's clock and the submit action. */
export class WritingViewModel {
  readonly clock: PhaseClock;

  constructor(private readonly manager: BluffManager) {
    const options = new OptionsReader<BluffOptions>(manager, BluffOptionsSchema, DEFAULT_OPTIONS);
    this.clock = new PhaseClock(manager, () => options.current.writingSeconds);
  }

  get prompt(): string {
    return this.manager.state?.promptText ?? "";
  }

  get roundLabel(): string {
    const state = this.manager.state;
    return roundLabel(state?.roundNumber ?? 0, state?.totalRounds ?? 0);
  }

  /** One row per seated player, in seat order, for the writers strip. */
  get rows(): ProgressRow[] {
    const state = this.manager.state;
    if (state === undefined) return [];
    return [...state.players.values()].map((seat) => {
      const done = state.progress.get(seat.id) === true;
      return {
        playerId: seat.id,
        name: seat.name,
        answered: done ? 1 : 0,
        expected: 1,
        done,
        typing: false,
        isMe: seat.id === this.manager.playerId,
      };
    });
  }

  get myDone(): boolean {
    return this.manager.state?.progress.get(this.manager.playerId) === true;
  }

  /** The text filter's refusal for the last rejected fake; empty when there is none to show. */
  get rejectionReason(): string {
    const error = this.manager.lastServerError;
    return error?.code === ErrorCode.CONTENT_REJECTED ? error.message : "";
  }

  /** Sends the fake answer; resolves `true` when the server accepts it, clearing a previous filter refusal. */
  async submit(text: string): Promise<boolean> {
    const result = await this.manager.sendAction(ACTION.SUBMIT_FAKE, { text });
    if (!result.ok) return false;
    // The rejection is answered: clear the reason and the toast it drove.
    this.manager.dismissError();
    return true;
  }
}
