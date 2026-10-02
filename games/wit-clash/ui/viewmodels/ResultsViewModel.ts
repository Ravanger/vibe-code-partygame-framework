import { ACTION } from "../../src/actionNames.js";
import type { WitClashManager } from "../manager.js";
import { MatchupRecap, type RevealedMatchup } from "./MatchupRecap.js";
import { Podium, type PodiumStep } from "./Podium.js";
import { Scoreboard, type ScoreRow } from "./Scoreboard.js";

export interface BestAnswerView {
  text: string;
  promptText: string;
  authorName: string;
  votes: number;
  isMine: boolean;
}

export class ResultsViewModel {
  readonly scoreboard: Scoreboard;
  private readonly podium: Podium;
  private readonly recap: MatchupRecap;

  constructor(private readonly manager: WitClashManager) {
    this.scoreboard = new Scoreboard(manager);
    this.recap = new MatchupRecap(manager);
    this.podium = new Podium(this.scoreboard);
  }

  get podiumSteps(): PodiumStep[] {
    return this.podium.steps;
  }

  get bestAnswers(): BestAnswerView[] {
    return [...(this.manager.state?.bestAnswers ?? [])].map((best) => ({
      text: best.text,
      promptText: best.promptText,
      authorName: best.authorName,
      votes: best.votes,
      isMine: best.authorId === this.manager.playerId,
    }));
  }

  get bestAnswerTitle(): string {
    return this.bestAnswers.length > 1 ? "Shared best answer" : "Best answer";
  }

  get isFinalRound(): boolean {
    return this.manager.state?.isFinalRound ?? false;
  }

  get roundLabel(): string {
    const state = this.manager.state;
    return `Round ${state?.roundNumber ?? 0} of ${state?.totalRounds ?? 0}`;
  }

  get champions(): ScoreRow[] {
    return this.isFinalRound
      ? this.scoreboard.rows.filter((row) => row.rank === 1 && !row.hasLeft)
      : [];
  }

  get championLine(): string {
    const [first] = this.champions;
    if (first === undefined) return "";
    const names = this.champions.map((champion) => champion.name).join(" & ");
    return `${names} ${this.champions.length > 1 ? "win" : "wins"} with ${first.score} points!`;
  }

  get waitingText(): string {
    return this.isFinalRound
      ? "Waiting for host to start a new game..."
      : "Waiting for host to continue...";
  }

  get matchups(): RevealedMatchup[] {
    return this.recap.all;
  }

  get isSpectator(): boolean {
    return this.manager.isSpectator;
  }

  get isHost(): boolean {
    return this.manager.isHost;
  }

  get showNextRound(): boolean {
    return this.isHost && !this.isFinalRound;
  }

  get showPlayAgain(): boolean {
    return this.isHost && this.isFinalRound;
  }

  async nextRound(): Promise<void> {
    await this.manager.sendAction(ACTION.NEXT_ROUND);
  }

  async playAgain(): Promise<void> {
    await this.manager.sendAction(ACTION.PLAY_AGAIN);
  }
}
