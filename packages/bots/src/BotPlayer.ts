import { ClientMessage, isActionResult, LOBBY_PHASE, START_GAME } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";
import type {
  BotOptions,
  BotOutcome,
  BotRoom,
  BotSpeed,
  BotStrategy,
  BotTurn,
  DelayRange,
} from "./types.js";

const DEFAULT_THINK: DelayRange = [2000, 6000];
const DEFAULT_REACT: DelayRange = [500, 2500];

/** `ok` for an accepted action, with the raw answer as `detail`. */
export const outcomeOf = (bot: string, type: string, result: unknown): BotOutcome => ({
  bot,
  type,
  ok: isActionResult(result) && result.ok,
  detail: JSON.stringify(result),
});

/** One automatic player on a connected room, driven by a game's {@link BotStrategy}. */
export class BotPlayer<TState extends BaseGameState> {
  private readonly handled = new Set<string>();
  private readonly cancels = new Set<() => void>();
  private readonly rng: () => number;
  private readonly schedule: (run: () => void, ms: number) => () => void;
  private phase = "";
  private starting = false;
  private left = false;

  constructor(
    readonly room: BotRoom<TState>,
    readonly playerId: string,
    readonly name: string,
    private readonly strategy: BotStrategy<TState>,
    private readonly options: BotOptions = {},
  ) {
    this.rng = options.rng ?? Math.random;
    this.schedule = options.schedule ?? ((run, ms) => this.timer(run, ms));
    room.onLeave(() => this.stop());
    room.onStateChange(() => this.react());
    this.react();
  }

  async leave(): Promise<void> {
    if (this.left) return;
    this.stop();
    await this.room.leave(true);
  }

  private stop(): void {
    this.left = true;
    this.cancelPending();
  }

  private react(): void {
    if (this.left) return;
    const state = this.room.state;
    if (state.phase !== this.phase) {
      this.phase = state.phase;
      this.handled.clear();
      this.cancelPending();
    }
    const turn = this.turn();
    if (this.options.host) {
      this.startWhenReady();
      this.strategy.host?.(turn);
    }
    this.strategy.play(turn);
  }

  private turn(): BotTurn<TState> {
    return {
      state: this.room.state,
      playerId: this.playerId,
      name: this.name,
      once: (key, run) => this.once(key, run),
      later: (delay, run) => this.later(delay, run),
      act: (type, payload = {}, note = type) => {
        void this.send(type, payload, note);
      },
      pick: (items) => items[Math.floor(this.rng() * items.length)],
    };
  }

  private startWhenReady(): void {
    const state = this.room.state;
    if (state.phase !== LOBBY_PHASE) {
      this.starting = false;
      return;
    }
    const named = [...state.players.values()].filter((seat) => seat.name !== "").length;
    if (!state.canStart || this.starting || named < (this.options.host?.expectedPlayers ?? 0))
      return;
    this.starting = true;
    void this.send(START_GAME, {}, START_GAME).then((ok) => {
      if (!ok) this.starting = false;
    });
  }

  private async send(type: string, payload: object, note: string): Promise<boolean> {
    const outcome = await this.room.request(ClientMessage.ACTION, { ...payload, type }).then(
      (result) => {
        this.options.log?.(`${this.name} ${note} -> ${JSON.stringify(result)}`);
        return outcomeOf(this.name, type, result);
      },
      (error: unknown) => {
        this.options.log?.(`${this.name} ${type} failed: ${String(error)}`);
        return { bot: this.name, type, ok: false, detail: String(error) };
      },
    );
    this.options.onOutcome?.(outcome);
    return outcome.ok;
  }

  private once(key: string, run: () => void): void {
    if (this.handled.has(key)) return;
    this.handled.add(key);
    run();
  }

  private later(delay: BotSpeed | DelayRange, run: () => void): void {
    const [min, max] = this.range(delay);
    const cancel = this.schedule(
      () => {
        this.cancels.delete(cancel);
        run();
      },
      min + this.rng() * (max - min),
    );
    this.cancels.add(cancel);
  }

  private range(delay: BotSpeed | DelayRange): DelayRange {
    if (delay === "think") return this.options.thinkMs ?? DEFAULT_THINK;
    if (delay === "react") return this.options.reactMs ?? DEFAULT_REACT;
    return delay;
  }

  private cancelPending(): void {
    for (const cancel of this.cancels) cancel();
    this.cancels.clear();
  }

  private timer(run: () => void, ms: number): () => void {
    const handle = setTimeout(run, ms);
    return () => clearTimeout(handle);
  }
}
