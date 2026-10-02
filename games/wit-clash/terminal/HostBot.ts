import { ClientMessage, LOBBY_PHASE, START_GAME } from "@partygame/shared";
import {
  type BotOptions,
  type BotOutcome,
  BotPlayer,
  type BotRoom,
  outcomeOf,
} from "../bots/BotPlayer.js";
import { ACTION } from "../src/actionNames.js";
import { PHASE } from "../src/phaseNames.js";

export interface HostBotOptions extends BotOptions {
  /** Named players to wait for before starting; the server's minimum when omitted. */
  expectedPlayers?: number;
  /** Pause before pressing Next Round, so the results can be read. */
  nextRoundDelayMs?: number;
}

/** A bot that plays and also hosts: starts the game, advances every round, stops at the final results. */
export class HostBot {
  readonly player: BotPlayer;
  private starting = false;
  private readonly advanced = new Set<number>();
  private readonly cancels = new Set<() => void>();

  constructor(
    readonly room: BotRoom,
    readonly playerId: string,
    readonly name: string,
    private readonly options: HostBotOptions = {},
  ) {
    this.player = new BotPlayer(room, playerId, name, options);
    room.onStateChange(() => this.react());
    this.react();
  }

  leave(): Promise<void> {
    for (const cancel of this.cancels) cancel();
    this.cancels.clear();
    return this.player.leave();
  }

  private react(): void {
    const state = this.room.state;
    if (state.phase !== LOBBY_PHASE) this.starting = false;
    else if (
      state.canStart &&
      !this.starting &&
      this.seated() >= (this.options.expectedPlayers ?? 0)
    ) {
      this.starting = true;
      this.send(START_GAME).then((ok) => {
        if (!ok) this.starting = false;
      });
    }
    if (state.phase !== PHASE.Results || state.isFinalRound) return;
    if (this.advanced.has(state.roundNumber)) return;
    this.advanced.add(state.roundNumber);
    this.afterPause(() => this.send(ACTION.NEXT_ROUND));
  }

  private afterPause(run: () => void): void {
    const pause = this.options.nextRoundDelayMs ?? 0;
    if (pause <= 0) {
      run();
      return;
    }
    const schedule = this.options.schedule ?? this.timer;
    const cancel = schedule(() => {
      this.cancels.delete(cancel);
      run();
    }, pause);
    this.cancels.add(cancel);
  }

  private timer(run: () => void, ms: number): () => void {
    const handle = setTimeout(run, ms);
    return () => clearTimeout(handle);
  }

  private seated(): number {
    return [...this.room.state.players.values()].filter((seat) => seat.name !== "").length;
  }

  private async send(type: string): Promise<boolean> {
    const outcome: BotOutcome = await this.room.request(ClientMessage.ACTION, { type }).then(
      (result) => outcomeOf(this.name, type, result),
      (error: unknown) => ({ bot: this.name, type, ok: false, detail: String(error) }),
    );
    this.options.onOutcome?.(outcome);
    return outcome.ok;
  }
}
