import { Countdown } from "../countdown.svelte.js";

export type CategoryOption = {
  id: string;
  name: string;
  emoji: string;
  votes: number;
};

export type GameStateWithVotes = {
  categoryOptions: CategoryOption[];
  categoryVotes: Record<string, string>;
  phaseEndsAt: number;
  serverNow: number;
};

export type SendFn = (type: string, message?: unknown) => void;

export class CategoryVoteViewModel {
  private gameState = $state<GameStateWithVotes>({} as GameStateWithVotes);
  private playerId: string;
  private send: SendFn;

  countdown: Countdown;

  constructor(gameState: GameStateWithVotes, playerId: string, send: SendFn) {
    this.gameState = gameState;
    this.playerId = playerId;
    this.send = send;
    this.countdown = new Countdown(
      () => this.gameState.phaseEndsAt,
      () => this.gameState.serverNow,
    );
  }

  sync(gameState: GameStateWithVotes) {
    this.gameState = gameState;
  }

  get selectedCategoryId(): string | null {
    return this.gameState.categoryVotes[this.playerId] ?? null;
  }

  get hasVoted(): boolean {
    return this.selectedCategoryId !== null;
  }

  get canVote(): boolean {
    return !this.countdown.isExpired;
  }

  get categories(): Array<CategoryOption & { selected: boolean }> {
    return this.gameState.categoryOptions.map((opt) => ({
      ...opt,
      selected: opt.id === this.selectedCategoryId,
    }));
  }

  selectCategory(categoryId: string) {
    this.send("VOTE_CATEGORY", { categoryId });
  }
}
