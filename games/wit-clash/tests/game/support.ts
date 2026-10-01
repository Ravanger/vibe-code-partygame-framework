import { GameRuntime } from "@partygame/core";
import { FakeHost } from "@partygame/core/testing";
import {
  type Category,
  type CategoryRepository,
  categoriesFromArray,
} from "../../src/content/CategoryRepository.js";
import { createWitClashGame } from "../../src/game.js";
import { type WitClashOptions, WitClashOptionsSchema } from "../../src/options.js";
import type { WitClashPrivate } from "../../src/private.js";
import { type Matchup, type PlayerPrivate, WitClashState } from "../../src/state.js";

export function nth<T>(xs: readonly T[], index: number): T {
  const value = xs[index];
  if (value === undefined) throw new Error(`No item at index ${index}`);
  return value;
}

export const makeCategories = (
  count = 4,
  promptsEach = 8,
  tieBreakersEach = 0,
): CategoryRepository =>
  categoriesFromArray(
    Array.from(
      { length: count },
      (_, c): Category => ({
        id: `cat-${c}`,
        name: `Category ${c}`,
        emoji: "x",
        prompts: Array.from({ length: promptsEach }, (_, p) => ({
          id: `cat-${c}-p${p}`,
          text: `Prompt ${c}.${p}`,
        })),
        tieBreakers: Array.from({ length: tieBreakersEach }, (_, p) => ({
          id: `cat-${c}-tb${p}`,
          text: `Tie-breaker ${c}.${p}`,
        })),
      }),
    ),
  );

export interface TableConfig {
  players?: number;
  categories?: CategoryRepository;
  options?: Partial<WitClashOptions>;
}

/** A WitClash room driven through the real runtime and the real state schema, with a manual clock. */
export class Table {
  readonly host = new FakeHost();
  readonly state = new WitClashState();
  readonly runtime: GameRuntime<WitClashState, WitClashPrivate, WitClashOptions>;

  constructor(config: TableConfig = {}) {
    for (let i = 1; i <= (config.players ?? 4); ++i) this.host.seat(`p${i}`);
    this.runtime = new GameRuntime({
      definition: createWitClashGame({
        categories: config.categories ?? makeCategories(),
      }),
      state: this.state,
      options: WitClashOptionsSchema.parse(config.options ?? {}),
      host: this.host,
    });
  }

  get phase(): string {
    return this.state.phase;
  }

  get priv(): WitClashPrivate {
    return this.runtime.priv;
  }

  ids(): string[] {
    return this.host.seats.map((s) => s.id);
  }

  act(playerId: string, type: string, fields: Record<string, unknown> = {}): void {
    this.runtime.dispatch(playerId, { type, ...fields });
  }

  errors(playerId: string): Array<{ code: string }> {
    return this.host.errorsTo(playerId) as Array<{ code: string }>;
  }

  tick(ms: number): void {
    this.host.advance(ms);
  }

  mine(playerId: string): PlayerPrivate {
    return this.state.mine.get(playerId) as PlayerPrivate;
  }

  matchup(): Matchup {
    return this.state.matchups[this.state.activeMatchupIndex] as Matchup;
  }

  start(): void {
    this.act("p1", "START_GAME");
  }

  leave(playerId: string): void {
    this.host.kick(playerId);
    this.runtime.rosterChanged();
  }

  drop(playerId: string): void {
    const seat = this.host.seats.find((s) => s.id === playerId);
    if (seat) seat.isConnected = false;
    this.runtime.rosterChanged();
  }

  rejoin(playerId: string): void {
    const seat = this.host.seats.find((s) => s.id === playerId);
    if (seat) seat.isConnected = true;
    this.runtime.rosterChanged();
  }

  joinLate(playerId: string): void {
    this.host.seat(playerId, { isActive: false });
    this.runtime.rosterChanged();
  }

  /** Everyone votes for the first offered category; the phase moves on to Prompting. */
  voteFirstCategory(): string {
    const id = (this.state.categoryOptions[0] as { id: string }).id;
    for (const playerId of this.ids()) this.act(playerId, "VOTE_CATEGORY", { categoryId: id });
    return id;
  }

  /** Every assigned prompt gets an answer; the phase moves on to MatchupVoting. */
  answerEverything(): void {
    for (const playerId of this.ids()) {
      for (const prompt of this.state.mine.get(playerId)?.prompts ?? []) {
        this.act(playerId, "SUBMIT_ANSWER", {
          matchupId: prompt.matchupId,
          answer: `${playerId} on ${prompt.matchupId.slice(0, 4)}`,
        });
      }
    }
  }

  toPrompting(): void {
    this.start();
    this.voteFirstCategory();
  }

  toVoting(): void {
    this.toPrompting();
    this.answerEverything();
  }

  /** Authors of the active matchup, by playerId. */
  authors(): string[] {
    return this.matchup().answers.map((a) => this.priv.authors.get(a.id) as string);
  }

  /** The answer id written by `playerId` in the active matchup. */
  answerBy(playerId: string): string {
    return (
      this.matchup().answers.find((a) => this.priv.authors.get(a.id) === playerId) as { id: string }
    ).id;
  }

  eligible(): string[] {
    return this.ids().filter((id) => this.mine(id)?.canVote);
  }

  /** Every eligible voter backs the answer written by `authorId`; the matchup is revealed. */
  voteFor(authorId: string): void {
    const answerId = this.answerBy(authorId);
    for (const voter of this.eligible()) this.act(voter, "CAST_VOTE", { answerId });
  }

  /** Vote on and reveal every remaining matchup, favouring the first author each time. */
  playOutVoting(): void {
    for (;;) {
      if (this.phase === "MatchupVoting") this.voteFor(this.authors()[0] as string);
      else if (this.phase === "MatchupReveal") this.tick(5000);
      else return;
    }
  }

  toResults(): void {
    this.toVoting();
    this.playOutVoting();
  }
}
