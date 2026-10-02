import type { BotRoom } from "@partygame/bots";
import { ClientMessage, isActionResult, LOBBY_PHASE, START_GAME } from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";
import type { Prompter } from "./Prompter.js";
import type { TerminalPlayerOptions, TerminalStrategy, TerminalTurn } from "./types.js";

/** One human at a terminal: runs the strategy's questions stage by stage and keeps the lobby, clock and replies. */
export class TerminalPlayer<TState extends BaseGameState> {
  private readonly waiters = new Set<() => void>();
  private readonly ended = new AbortController();
  private readonly now: () => number;
  private readonly quitWord: string;
  private step: AbortController | undefined;
  private stage: string | undefined;
  private serverNow = 0;
  private serverNowSeenAt = 0;

  constructor(
    private readonly room: BotRoom<TState>,
    private readonly playerId: string,
    private readonly io: Prompter,
    private readonly strategy: TerminalStrategy<TState>,
    options: TerminalPlayerOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.quitWord = options.quitWord?.toLowerCase() ?? "q";
  }

  /** Starts playing; resolves when the player quits or the room goes away. Call `stop` after this. */
  run(): Promise<void> {
    const finished = new Promise<void>((resolve) =>
      this.ended.signal.addEventListener("abort", () => resolve(), { once: true }),
    );
    this.room.onStateChange(() => this.react());
    this.room.onLeave(() => {
      this.io.print("You have left the room.");
      this.stop();
    });
    this.react();
    return finished;
  }

  stop(): void {
    this.ended.abort();
    this.step?.abort();
  }

  private react(): void {
    if (this.ended.signal.aborted) return;
    const state = this.room.state;
    if (state.serverNow !== this.serverNow) {
      this.serverNow = state.serverNow;
      this.serverNowSeenAt = this.now();
    }
    for (const line of this.strategy.narrate?.(state) ?? []) this.io.print(line);
    for (const wake of [...this.waiters]) wake();
    const stage = this.strategy.stageOf?.(state) ?? state.phase;
    if (stage === this.stage) return;
    this.stage = stage;
    this.step?.abort();
    const controller = new AbortController();
    this.step = controller;
    this.play(state.phase, this.turn(controller.signal)).catch((error: unknown) => {
      if (!controller.signal.aborted) this.io.print(`Something went wrong: ${String(error)}`);
    });
  }

  private async play(phase: string, turn: TerminalTurn<TState>): Promise<void> {
    if (phase !== LOBBY_PHASE) return this.strategy.play(turn);
    return this.strategy.lobby ? this.strategy.lobby(turn) : this.lobby(turn);
  }

  private turn(signal: AbortSignal): TerminalTurn<TState> {
    const room = this.room;
    const playerId = this.playerId;
    return {
      get state() {
        return room.state;
      },
      playerId,
      quitWord: this.quitWord,
      get isHost() {
        return room.state.players.get(playerId)?.role === "host";
      },
      signal,
      ask: async (question) => (await this.io.ask(question, signal)).trim(),
      print: (line) => this.io.print(line),
      send: (type, payload, accepted) => this.send(type, payload, accepted),
      notify: (type, payload) => this.notify(type, payload),
      changed: () => this.changed(signal),
      timeLeft: () => this.timeLeft(),
      quit: () => this.stop(),
    };
  }

  private timeLeft(): string {
    const state = this.room.state;
    if (state.phaseEndsAt === 0) return "";
    const estimate = state.serverNow + (this.now() - this.serverNowSeenAt);
    return ` ${Math.max(0, Math.ceil((state.phaseEndsAt - estimate) / 1000))}s left`;
  }

  private changed(signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const wake = (): void => {
        signal.removeEventListener("abort", wake);
        this.waiters.delete(wake);
        resolve();
      };
      this.waiters.add(wake);
      signal.addEventListener("abort", wake, { once: true });
    });
  }

  private notify(type: string, payload: object): void {
    this.room.request(ClientMessage.ACTION, { ...payload, type }).catch(() => undefined);
  }

  private async send(type: string, payload: object, accepted: string): Promise<boolean> {
    try {
      const result = await this.room.request(ClientMessage.ACTION, { ...payload, type });
      if (!isActionResult(result)) {
        this.io.print("The server sent an unexpected reply.");
        return false;
      }
      this.io.print(result.ok ? accepted : `Refused: ${result.error.message}`);
      return result.ok;
    } catch (error) {
      this.io.print(`Could not send that: ${String(error)}`);
      return false;
    }
  }

  private async lobby(turn: TerminalTurn<TState>): Promise<void> {
    const host = turn.isHost;
    const question = host
      ? `Press Enter to start the game, or ${this.quitWord} to quit: `
      : `Waiting for the host to start. Type ${this.quitWord} to quit: `;
    while (!turn.signal.aborted) {
      const answer = (await turn.ask(question)).toLowerCase();
      if (answer === this.quitWord) return turn.quit();
      if (host && (await turn.send(START_GAME, {}, "Starting..."))) return;
    }
  }
}
