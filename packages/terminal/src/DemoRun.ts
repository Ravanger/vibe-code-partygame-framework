import { randomUUID } from "node:crypto";
import { type BotKit, type BotOptions, type BotOutcome, DemoTable } from "@partygame/bots";
import type { HostedGame } from "@partygame/server";
import { type NodeServerHandle, startNodeServer } from "@partygame/server/node";
import type { BaseGameState } from "@partygame/shared/schema";
import { GameClient, type GameRoomOf } from "./GameClient.js";

export interface DemoRunOptions<TState extends BaseGameState> {
  /** Started on free ports with `startNodeServer`; must include `kit.roomName`. */
  games: HostedGame[];
  kit: BotKit<TState>;
  /** Bots besides the host bot. */
  bots: number;
  /** Create options for the room. */
  roomOptions?: object;
  /** Pacing and logging for every bot; `onOutcome` still fires, and refusals are also collected. */
  bot?: BotOptions;
  hostName?: string;
  /** True once the game is over. */
  finished(state: TState): boolean;
  /** Lines to print on each spectator state change (a commentator). */
  narrate?(state: TState): readonly string[];
  /** Game-specific problems in the final spectator state, e.g. scores that do not add up. */
  problems?(state: TState): readonly string[];
  /** Default "PASS: no action was rejected". */
  passMessage?: string;
  out(line: string): void;
  /** Default 180000. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_PASS_MESSAGE = "PASS: no action was rejected";

/** One all-bot game on its own server: a host bot, `bots` bots and a narrating spectator, then a PASS/FAIL verdict. */
export class DemoRun<TState extends BaseGameState> {
  private readonly outcomes: BotOutcome[] = [];

  constructor(private readonly options: DemoRunOptions<TState>) {}

  /** True when the game finished, `problems` found nothing and no action was refused. */
  async run(): Promise<boolean> {
    const { out } = this.options;
    let server: NodeServerHandle | undefined;
    let table: DemoTable<TState> | undefined;
    let spectator: GameRoomOf<TState> | undefined;
    try {
      server = await startNodeServer({ games: this.options.games });
      out(`Demo server on ${server.endpoint}, code API on port ${server.apiPort}`);
      table = this.tableOn(server);
      const code = await table.open();
      out(`Room ${code}: ${this.options.bots + 1} players`);
      spectator = await new GameClient(server.endpoint, server.apiPort, this.options.kit).watch(
        code,
        randomUUID(),
      );
      await this.play(table, spectator);
      const problems = this.problems(spectator.state);
      for (const line of this.verdict(problems)) out(line);
      return problems.length === 0;
    } catch (error) {
      out(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      await Promise.allSettled([spectator?.leave(), table?.leave()]);
      await server?.stop();
    }
  }

  private tableOn(server: NodeServerHandle): DemoTable<TState> {
    const { kit, bots, roomOptions, hostName, finished } = this.options;
    return new DemoTable({
      ...kit,
      endpoint: server.endpoint,
      apiPort: server.apiPort,
      bots,
      ...(roomOptions ? { roomOptions } : {}),
      ...(hostName ? { hostName } : {}),
      bot: {
        ...this.options.bot,
        onOutcome: (outcome) => {
          this.outcomes.push(outcome);
          this.options.bot?.onOutcome?.(outcome);
        },
      },
      isFinished: finished,
    });
  }

  private async play(table: DemoTable<TState>, spectator: GameRoomOf<TState>): Promise<void> {
    const { out, timeoutMs = DEFAULT_TIMEOUT_MS } = this.options;
    const narrate = this.options.narrate ?? (() => []);
    const failure = new AbortController();
    const narrationFailed = new Promise<never>((_, reject) => {
      failure.signal.addEventListener("abort", () => reject(failure.signal.reason), { once: true });
    });
    narrationFailed.catch(() => undefined);
    const onChange = () => {
      try {
        for (const line of narrate(spectator.state)) out(line);
      } catch (error) {
        failure.abort(error);
      }
    };
    spectator.onStateChange(onChange);
    try {
      await table.seatBots();
      await Promise.race([table.finished(timeoutMs), narrationFailed]);
    } finally {
      spectator.onStateChange.remove(onChange);
    }
  }

  private problems(state: TState): string[] {
    return [
      ...(this.options.problems?.(state) ?? []),
      ...this.outcomes
        .filter((outcome) => !outcome.ok)
        .map((outcome) => `${outcome.bot} was refused on ${outcome.type}: ${outcome.detail}`),
    ];
  }

  private verdict(problems: readonly string[]): string[] {
    if (problems.length === 0) return ["", this.options.passMessage ?? DEFAULT_PASS_MESSAGE];
    return ["", ...problems.map((problem) => `  - ${problem}`), "FAIL"];
  }
}
