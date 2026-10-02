import { required } from "@partygame/core";
import { ClientMessage, isActionResult, LOBBY_PHASE, START_GAME } from "@partygame/shared";
import type { BotRoom } from "../bots/BotPlayer.js";
import { ACTION } from "../src/actionNames.js";
import { PHASE } from "../src/phaseNames.js";
import type { WitClashState } from "../src/state.js";
import { Narrator } from "./Narrator.js";
import type { Prompter } from "./Prompter.js";

export interface PlayerRoom extends BotRoom {
  onLeave(callback: () => void): unknown;
}

export interface TerminalPlayerOptions {
  now?: () => number;
}

const QUIT = "q";

/** One human at a terminal: turns each phase into a question and the answer into an action. */
export class TerminalPlayer {
  private readonly narrator = new Narrator();
  private readonly waiters = new Set<() => void>();
  private readonly ended = new AbortController();
  private readonly now: () => number;
  private step: AbortController | undefined;
  private stage = "";
  private serverNow = 0;
  private serverNowSeenAt = 0;

  constructor(
    private readonly room: PlayerRoom,
    private readonly playerId: string,
    private readonly io: Prompter,
    options: TerminalPlayerOptions = {},
  ) {
    this.now = options.now ?? Date.now;
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
    for (const line of this.narrator.update(state)) this.io.print(line);
    for (const wake of [...this.waiters]) wake();
    const stage = this.stageOf(state);
    if (stage === this.stage) return;
    this.stage = stage;
    this.step?.abort();
    const controller = new AbortController();
    this.step = controller;
    this.play(state.phase, controller.signal).catch((error: unknown) => {
      if (!controller.signal.aborted) this.io.print(`Something went wrong: ${String(error)}`);
    });
  }

  private stageOf(state: WitClashState): string {
    const round = `${state.roundNumber}:${state.phase}`;
    if (state.phase === PHASE.MatchupVoting) return `${round}:${state.activeMatchupIndex}`;
    return `${round}:${state.tieBreakers.length}`;
  }

  private play(phase: string, signal: AbortSignal): Promise<void> {
    switch (phase) {
      case LOBBY_PHASE:
        return this.lobby(signal);
      case PHASE.CategorySelection:
        return this.pickCategory(signal);
      case PHASE.Prompting:
      case PHASE.TieBreakerPrompting:
        return this.answerPrompts(signal);
      case PHASE.MatchupVoting:
      case PHASE.TieBreakerVoting:
        return this.castVote(signal);
      case PHASE.Results:
        return this.results(signal);
      default:
        return Promise.resolve();
    }
  }

  private isHost(): boolean {
    return this.room.state.players.get(this.playerId)?.role === "host";
  }

  private left(): string {
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

  private async lobby(signal: AbortSignal): Promise<void> {
    const host = this.isHost();
    const question = host
      ? "Press Enter to start the game, or q to quit: "
      : "Waiting for the host to start. Type q to quit: ";
    while (!signal.aborted) {
      const answer = (await this.io.ask(question, signal)).trim().toLowerCase();
      if (answer === QUIT) return this.stop();
      if (host && (await this.send(START_GAME, {}, "Starting..."))) return;
    }
  }

  private async pickCategory(signal: AbortSignal): Promise<void> {
    const options = [...this.room.state.categoryOptions];
    while (!signal.aborted) {
      const answer = (
        await this.io.ask(
          `Vote for a category, 1-${options.length}${this.left()}, q to quit: `,
          signal,
        )
      )
        .trim()
        .toLowerCase();
      if (answer === QUIT) return this.stop();
      const option = options[Number(answer) - 1];
      if (option) {
        await this.send(
          ACTION.VOTE_CATEGORY,
          { categoryId: option.id },
          `Voted for ${option.name}.`,
        );
      } else {
        this.io.print(`Enter a number from 1 to ${options.length}.`);
      }
    }
  }

  private async answerPrompts(signal: AbortSignal): Promise<void> {
    const answered = new Set<string>();
    let typing = false;
    let waiting = false;
    while (!signal.aborted) {
      const mine = this.room.state.mine.get(this.playerId);
      const open = [...(mine?.prompts ?? [])].filter(
        (prompt) => !prompt.submitted && !answered.has(prompt.matchupId),
      );
      const next = open[0];
      if (!next) {
        if (!waiting) this.io.print("Waiting for the others...");
        waiting = true;
        await this.changed(signal);
        continue;
      }
      waiting = false;
      if (!typing) {
        typing = true;
        void this.room.request(ClientMessage.ACTION, { type: ACTION.SET_TYPING, typing: true });
      }
      const text = (
        await this.io.ask(
          `Prompt: ${next.promptText}\nYour answer${this.left()} (/q quits): `,
          signal,
        )
      ).trim();
      if (text === `/${QUIT}`) return this.stop();
      if (text === "") continue;
      const sent = await this.send(
        ACTION.SUBMIT_ANSWER,
        { matchupId: next.matchupId, answer: text },
        "Answer sent.",
      );
      if (sent) answered.add(next.matchupId);
    }
  }

  private async castVote(signal: AbortSignal): Promise<void> {
    const state = this.room.state;
    const matchup =
      state.phase === PHASE.TieBreakerVoting
        ? required(state.tieBreakers[state.tieBreakers.length - 1], "tie-breaker")
        : required(state.matchups[state.activeMatchupIndex], "matchup");
    const answers = [...matchup.answers];
    let waiting = false;
    while (!signal.aborted) {
      const mine = this.room.state.mine.get(this.playerId);
      if (!mine?.canVote) {
        if (!waiting) {
          this.io.print(
            mine?.isOwnMatchup
              ? "You are in this one, so you wait while the others vote."
              : "You cannot vote on this one, so you wait.",
          );
        }
        waiting = true;
        await this.changed(signal);
        continue;
      }
      const answer = (
        await this.io.ask(`Vote for 1-${answers.length}${this.left()}, q to quit: `, signal)
      )
        .trim()
        .toLowerCase();
      if (answer === QUIT) return this.stop();
      const chosen = answers[Number(answer) - 1];
      if (chosen) {
        await this.send(ACTION.CAST_VOTE, { answerId: chosen.id }, `Voted for "${chosen.text}".`);
      } else {
        this.io.print(`Enter a number from 1 to ${answers.length}.`);
      }
    }
  }

  private async results(signal: AbortSignal): Promise<void> {
    const final = this.room.state.isFinalRound;
    const host = this.isHost();
    const actions: Record<string, string> = host
      ? final
        ? { a: ACTION.PLAY_AGAIN, e: ACTION.END_GAME }
        : { n: ACTION.NEXT_ROUND, e: ACTION.END_GAME }
      : {};
    const menu = host
      ? final
        ? "[a]gain, [e]nd game or [q]uit: "
        : "[n]ext round, [e]nd game or [q]uit: "
      : "Waiting for the host. [q]uit: ";
    while (!signal.aborted) {
      const answer = (await this.io.ask(menu, signal)).trim().toLowerCase();
      if (answer === QUIT) return this.stop();
      const type = actions[answer];
      if (type && (await this.send(type, {}, "Done."))) return;
    }
  }
}
