import type { GameConnectionManager } from "@partygame/game-client/connection";
import { Countdown } from "@partygame/game-client/countdown";

interface Answer {
  id: string;
  text: string;
  votes: number;
  authorId: string;
}

interface Matchup {
  id: string;
  index: number;
  promptText: string;
  isRevealed: boolean;
  answers: Answer[];
}

interface VotingState {
  matchups: Matchup[];
  activeMatchupIndex: number;
  isRevealing: boolean;
  answerVotes: Map<string, string>;
  phaseEndsAt: number;
  serverNow: number;
  players: Map<string, { name: string }>;
}

export interface VoteAnswer {
  id: string;
  text: string;
  votes: number;
  authorName: string;
}

export class MatchupVoteViewModel {
  private readonly countdown: Countdown;

  constructor(private readonly manager: GameConnectionManager) {
    this.countdown = new Countdown(
      () => this.state?.phaseEndsAt ?? 0,
      () => this.state?.serverNow ?? 0,
    );
  }

  private readonly state = $derived(
    this.manager.stateVersion >= 0
      ? (this.manager.room?.state as VotingState | undefined)
      : undefined,
  );

  private readonly activeMatchup = $derived.by((): Matchup | undefined => {
    const idx = this.state?.activeMatchupIndex;
    if (idx === undefined || idx < 0 || !this.state?.matchups) return undefined;
    return this.state.matchups[idx];
  });

  readonly promptText = $derived(this.activeMatchup?.promptText ?? "");

  readonly answers = $derived.by((): VoteAnswer[] => {
    if (!this.activeMatchup) return [];
    return this.activeMatchup.answers.map((a) => ({
      id: a.id,
      text: a.text,
      votes: a.votes,
      authorName: this.resolveAuthorName(a.authorId),
    }));
  });

  readonly isRevealed = $derived(this.activeMatchup?.isRevealed ?? false);

  readonly myVote = $derived(
    this.state?.answerVotes?.get(this.manager.room?.sessionId ?? "") ?? "",
  );

  readonly totalVotes = $derived(this.answers.reduce((sum, a) => sum + a.votes, 0));

  readonly secondsLeft = $derived(this.countdown.secondsLeft);
  readonly isUrgent = $derived(this.countdown.isUrgent);

  private resolveAuthorName(authorId: string): string {
    if (!authorId || !this.state?.players) return "";
    return this.state.players.get(authorId)?.name ?? "";
  }

  vote(answerId: string) {
    this.manager.room?.send("ACTION", { type: "CAST_VOTE", answerId });
  }

  destroy() {
    this.countdown.destroy();
  }
}
