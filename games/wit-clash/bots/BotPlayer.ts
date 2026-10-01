import { ClientMessage } from "@partygame/shared";
import { ACTION } from "../src/actionNames.js";
import { PHASE } from "../src/phaseNames.js";
import type { Matchup, PlayerPrivate, WitClashState } from "../src/state.js";

export interface BotRoom {
  readonly state: WitClashState;
  onStateChange(callback: () => void): unknown;
  request(type: string, payload: object): Promise<unknown>;
  leave(consented: boolean): Promise<unknown>;
}

export type DelayRange = readonly [minMs: number, maxMs: number];

export interface BotOptions {
  rng?: () => number;
  /** Runs `run` after `ms` and returns a canceller. */
  schedule?: (run: () => void, ms: number) => () => void;
  answerDelayMs?: DelayRange;
  voteDelayMs?: DelayRange;
  log?: (line: string) => void;
}

export const BOT_ANSWERS: readonly string[] = [
  "A suspiciously large goose",
  "My neighbour's wifi password",
  "Honestly, a nap",
  "Whatever the cat knocked over",
  "Three raccoons in a trench coat",
  "Lukewarm soup",
  "The sequel nobody asked for",
  "Gravity, but optional",
  "Grandma's secret recipe",
  "An aggressively average sandwich",
];

const DEFAULT_ANSWER_DELAY: DelayRange = [2000, 6000];
const DEFAULT_VOTE_DELAY: DelayRange = [500, 2500];

/** One automatic WitClash player on a connected room. It never sends host-only actions. */
export class BotPlayer {
  private readonly handled = new Set<string>();
  private readonly cancels = new Set<() => void>();
  private readonly rng: () => number;
  private readonly schedule: (run: () => void, ms: number) => () => void;
  private readonly answerDelayMs: DelayRange;
  private readonly voteDelayMs: DelayRange;
  private readonly log: (line: string) => void;
  private phase = "";

  constructor(
    readonly room: BotRoom,
    readonly playerId: string,
    readonly name: string,
    options: BotOptions = {},
  ) {
    this.rng = options.rng ?? Math.random;
    this.schedule =
      options.schedule ??
      ((run, ms) => {
        const handle = setTimeout(run, ms);
        return () => clearTimeout(handle);
      });
    this.answerDelayMs = options.answerDelayMs ?? DEFAULT_ANSWER_DELAY;
    this.voteDelayMs = options.voteDelayMs ?? DEFAULT_VOTE_DELAY;
    this.log = options.log ?? (() => undefined);
    room.onStateChange(() => this.react());
    this.react();
  }

  async leave(): Promise<void> {
    this.cancelPending();
    await this.room.leave(true);
  }

  private cancelPending(): void {
    for (const cancel of this.cancels) cancel();
    this.cancels.clear();
  }

  private react(): void {
    const state = this.room.state;
    if (state.phase !== this.phase) {
      this.phase = state.phase;
      this.handled.clear();
      this.cancelPending();
    }
    const mine = state.mine.get(this.playerId);
    const stage = `${state.roundNumber}:${state.phase}`;
    switch (state.phase) {
      case PHASE.CategorySelection:
        this.voteCategory(state, stage);
        break;
      case PHASE.Prompting:
      case PHASE.TieBreakerPrompting:
        this.answer(mine, stage);
        break;
      case PHASE.MatchupVoting:
        this.voteMatchup(state, mine, stage);
        break;
      case PHASE.TieBreakerVoting:
        this.voteTieBreaker(state, mine, stage);
        break;
    }
  }

  private voteCategory(state: WitClashState, stage: string): void {
    const option = state.categoryOptions[this.index(state.categoryOptions.length)];
    if (!option) return;
    this.once(stage, () =>
      this.later(this.voteDelayMs, () =>
        this.act("votes for", ACTION.VOTE_CATEGORY, { categoryId: option.id }, option.name),
      ),
    );
  }

  private answer(mine: PlayerPrivate | undefined, stage: string): void {
    const open = [...(mine?.prompts ?? [])].filter((prompt) => !prompt.submitted);
    if (open.length === 0) return;
    this.once(`${stage}:typing`, () => this.act("types", ACTION.SET_TYPING, { typing: true }, ""));
    for (const prompt of open) {
      this.once(`${stage}:${prompt.matchupId}`, () =>
        this.later(this.answerDelayMs, () =>
          this.act(
            "answers",
            ACTION.SUBMIT_ANSWER,
            { matchupId: prompt.matchupId, answer: BOT_ANSWERS[this.index(BOT_ANSWERS.length)] },
            prompt.promptText,
          ),
        ),
      );
    }
  }

  private voteMatchup(state: WitClashState, mine: PlayerPrivate | undefined, stage: string): void {
    const matchup = state.matchups[state.activeMatchupIndex];
    if (matchup) this.voteOn(matchup.answers, mine, `${stage}:${matchup.id}`);
  }

  private voteTieBreaker(
    state: WitClashState,
    mine: PlayerPrivate | undefined,
    stage: string,
  ): void {
    const matchup = state.tieBreakers[state.tieBreakers.length - 1];
    if (matchup) this.voteOn(matchup.answers, mine, `${stage}:${matchup.id}`);
  }

  private voteOn(answers: Matchup["answers"], mine: PlayerPrivate | undefined, key: string): void {
    const answer = answers[this.index(answers.length)];
    if (!mine?.canVote || !answer) return;
    this.once(key, () =>
      this.later(this.voteDelayMs, () =>
        this.act("votes for", ACTION.CAST_VOTE, { answerId: answer.id }, answer.text),
      ),
    );
  }

  private act(verb: string, type: string, payload: object, detail: string): void {
    this.room
      .request(ClientMessage.ACTION, { ...payload, type })
      .then((result) => this.log(`${this.name} ${verb} ${detail} -> ${JSON.stringify(result)}`))
      .catch((error: unknown) => this.log(`${this.name} ${type} failed: ${String(error)}`));
  }

  private once(key: string, run: () => void): void {
    if (this.handled.has(key)) return;
    this.handled.add(key);
    run();
  }

  private later(range: DelayRange, run: () => void): void {
    const [min, max] = range;
    const cancel = this.schedule(
      () => {
        this.cancels.delete(cancel);
        run();
      },
      min + this.rng() * (max - min),
    );
    this.cancels.add(cancel);
  }

  private index(length: number): number {
    return Math.floor(this.rng() * length);
  }
}
