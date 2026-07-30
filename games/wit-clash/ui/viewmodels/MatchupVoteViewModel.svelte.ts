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
  private readonly state = $derived.by(() =>
    this.manager.stateVersion >= 0
      ? (this.manager.room?.state as VotingState | undefined)
      : undefined,
  );

  private countdown: Countdown | undefined;

  constructor(private readonly manager: GameConnectionManager) {
    this.countdown = new Countdown(
      () => this.state?.phaseEndsAt ?? 0,
      () => this.state?.serverNow ?? 0,
    );
  }

  private readonly activeMatchup = $derived.by((): Matchup | undefined => {
    const idx = this.state?.activeMatchupIndex;
    if (idx === undefined || idx < 0 || !this.state?.matchups) return undefined;
    return this.state.matchups[idx];
  });

  readonly promptText = $derived.by(() => this.activeMatchup?.promptText ?? "");

  readonly matchupNumber = $derived.by(() => (this.state?.activeMatchupIndex ?? -1) + 1);
  readonly totalMatchups = $derived.by(() => this.state?.matchups.length ?? 0);

  readonly answers = $derived.by((): VoteAnswer[] => {
    if (!this.activeMatchup) return [];
    return this.activeMatchup.answers.map((a) => ({
      id: a.id,
      text: a.text,
      votes: a.votes,
      authorName: this.resolveAuthorName(a.authorId),
    }));
  });

  readonly isRevealed = $derived.by(() => this.activeMatchup?.isRevealed ?? false);

  readonly myVote = $derived.by(
    () => this.state?.answerVotes?.get(this.manager.room?.sessionId ?? "") ?? "",
  );

  readonly isAuthor = $derived.by(() => this.authorIds.has(this.manager.room?.sessionId ?? ""));

  readonly totalVotes = $derived.by(() => this.answers.reduce((sum, a) => sum + a.votes, 0));

  private readonly authorIds = $derived.by(
    () => new Set(this.activeMatchup?.answers.map((a) => a.authorId) ?? []),
  );

  readonly eligibleVoterCount = $derived.by(() => {
    const players = this.state?.players;
    if (!players) return 0;
    let count = 0;
    for (const id of players.keys()) if (!this.authorIds.has(id)) ++count;
    return count;
  });

  readonly votedCount = $derived.by(() => {
    const votes = this.state?.answerVotes;
    const players = this.state?.players;
    if (!votes || !players) return 0;
    let count = 0;
    for (const id of votes.keys()) if (players.has(id) && !this.authorIds.has(id)) ++count;
    return count;
  });

  readonly secondsLeft = $derived.by(() => this.countdown?.secondsLeft ?? 0);
  readonly isUrgent = $derived.by(() => this.countdown?.isUrgent ?? false);

  private resolveAuthorName(authorId: string): string {
    if (!authorId || !this.state?.players) return "";
    return this.state.players.get(authorId)?.name ?? "";
  }

  vote(answerId: string) {
    this.manager.room?.send("ACTION", { type: "CAST_VOTE", answerId });
  }

  destroy() {
    this.countdown?.destroy();
  }
}
