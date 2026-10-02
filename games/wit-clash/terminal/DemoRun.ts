import type { Room } from "@colyseus/sdk";
import type { BotOutcome, DelayRange } from "../bots/BotPlayer.js";
import { joinBots } from "../bots/joinBots.js";
import { waitFor } from "../bots/waitFor.js";
import type { CategoryRepository } from "../src/content/CategoryRepository.js";
import { PHASE } from "../src/phaseNames.js";
import type { WitClashState } from "../src/state.js";
import { GameClient } from "./GameClient.js";
import { GameServerHandle } from "./GameServerHandle.js";
import { HostBot } from "./HostBot.js";
import { Narrator } from "./Narrator.js";

export interface DemoOptions {
  /** Players in total, the host bot included. */
  players: number;
  rounds: number;
  categories: CategoryRepository;
  out: (line: string) => void;
  answerDelayMs: DelayRange;
  voteDelayMs: DelayRange;
  revealSeconds: number;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 180_000;

/** An all-bot game on its own server, narrated line by line and checked against the scoreboard. */
export class DemoRun {
  private readonly narrator = new Narrator();
  private readonly outcomes: BotOutcome[] = [];
  private readonly leavers: Array<() => Promise<unknown>> = [];

  constructor(private readonly options: DemoOptions) {}

  /** Plays the game; true when it reached Results, the scores add up and no action was rejected. */
  async run(): Promise<boolean> {
    const { out } = this.options;
    const server = new GameServerHandle(this.options.categories);
    try {
      await server.start();
      out(`Demo server on ${server.endpoint}, code API on port ${server.apiPort}`);
      const spectator = await this.play(server);
      const problems = this.problems(spectator.state);
      for (const line of this.verdict(problems)) out(line);
      return problems.length === 0;
    } catch (error) {
      out(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      await Promise.allSettled(this.leavers.map((leave) => leave()));
      await server.stop();
    }
  }

  private async play(server: GameServerHandle): Promise<Room<WitClashState>> {
    const { players, rounds, revealSeconds, timeoutMs = DEFAULT_TIMEOUT_MS } = this.options;
    const client = new GameClient(server.endpoint, server.apiPort);
    const botOptions = {
      answerDelayMs: this.options.answerDelayMs,
      voteDelayMs: this.options.voteDelayMs,
      onOutcome: (outcome: BotOutcome) => this.record(outcome),
    };
    const hostId = crypto.randomUUID();
    const hostRoom = await client.create(hostId, "Host Bot", {
      totalRounds: rounds,
      categoryVoteSeconds: 5,
      promptSeconds: 15,
      voteSeconds: 5,
      revealSeconds,
    });
    const code = hostRoom.state.roomCode;
    this.options.out(`Room ${code}: ${players} players, ${rounds} round${rounds === 1 ? "" : "s"}`);
    const spectator = await client.watch(code, crypto.randomUUID());
    this.leavers.push(() => spectator.leave());
    const narrate = () => {
      for (const line of this.narrator.update(spectator.state)) this.options.out(line);
    };
    spectator.onStateChange(narrate);
    const host = new HostBot(hostRoom, hostId, "Host Bot", {
      ...botOptions,
      expectedPlayers: players,
    });
    this.leavers.push(() => host.leave());
    const bots = await joinBots({
      code,
      count: players - 1,
      endpoint: server.endpoint,
      apiPort: server.apiPort,
      bot: botOptions,
    });
    this.leavers.push(...bots.map((bot) => () => bot.leave()));
    try {
      await waitFor(
        () => spectator.state.phase === PHASE.Results && spectator.state.isFinalRound,
        "the final results",
        timeoutMs,
        100,
      );
    } finally {
      spectator.onStateChange.remove(narrate);
    }
    return spectator;
  }

  record(outcome: BotOutcome): void {
    this.outcomes.push(outcome);
  }

  /** What is wrong with the finished game: score mismatches and refused actions. */
  problems(state: WitClashState): string[] {
    return [
      ...this.narrator.discrepancies(state),
      ...this.outcomes
        .filter((outcome) => !outcome.ok)
        .map((outcome) => `${outcome.bot} was refused on ${outcome.type}: ${outcome.detail}`),
    ];
  }

  verdict(problems: string[]): string[] {
    if (problems.length === 0) {
      return ["", "PASS: scores match the reveals, no action was rejected"];
    }
    return ["", ...problems.map((problem) => `  - ${problem}`), "FAIL"];
  }
}
