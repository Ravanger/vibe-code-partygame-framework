import type { GameConnectionManager } from "@partygame/game-client/connection";
import { Countdown } from "@partygame/game-client/countdown";

interface VoteState {
  categoryOptions: Array<{ id: string; name: string; emoji: string; votes: number }>;
  categoryVotes: Map<string, string>;
  phaseEndsAt: number;
  serverNow: number;
  players: Map<string, { isConnected: boolean; isReady: boolean }>;
}

export class CategoryVoteViewModel {
  private lastAnnounced = $state(0);

  private readonly state = $derived.by(() =>
    this.manager.stateVersion >= 0
      ? (this.manager.room?.state as VoteState | undefined)
      : undefined,
  );

  private countdown: Countdown;

  constructor(private readonly manager: GameConnectionManager) {
    this.countdown = new Countdown(
      () => this.state?.phaseEndsAt ?? 0,
      () => this.state?.serverNow ?? 0,
    );
  }

  readonly options = $derived.by(() =>
    this.state?.categoryOptions ? [...this.state.categoryOptions] : [],
  );
  readonly totalVotes = $derived.by(() => this.options.reduce((n, o) => n + o.votes, 0));
  readonly myVote = $derived.by(() =>
    this.state?.categoryVotes?.get(this.manager.room?.sessionId ?? ""),
  );
  readonly playerCount = $derived.by(() =>
    this.state?.players
      ? [...this.state.players.values()].filter((p) => p.isConnected && p.isReady).length
      : 0,
  );

  readonly secondsLeft = $derived.by(() => this.countdown?.secondsLeft ?? 0);
  readonly isUrgent = $derived.by(() => this.countdown?.isUrgent ?? false);

  readonly countdownAnnouncement = $derived.by(() => {
    const sec = this.secondsLeft;
    if (sec === 30 || sec === 10 || sec === 5) {
      if (this.lastAnnounced !== sec) {
        this.lastAnnounced = sec;
        return `${sec} seconds remaining`;
      }
    }
    return "";
  });

  vote(categoryId: string) {
    this.manager.room?.send("ACTION", { type: "VOTE_CATEGORY", categoryId });
  }

  destroy() {
    this.countdown.destroy();
  }
}
