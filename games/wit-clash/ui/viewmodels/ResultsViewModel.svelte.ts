import type { GameConnectionManager } from "@partygame/game-client/connection";

interface ScoreEntry {
  playerId: string;
  name: string;
  score: number;
  roundPoints: number;
  matchupsWon: number;
  hadClash: boolean;
}

interface PlayerInfo {
  id: string;
  name: string;
  role: string;
  isReady: boolean;
  isConnected: boolean;
}

interface AnswerInfo {
  id: string;
  text: string;
  votes: number;
  authorId: string;
}

interface MatchupInfo {
  id: string;
  index: number;
  promptText: string;
  answers: AnswerInfo[];
  isRevealed: boolean;
}

interface ResultsState {
  scoreboard: ScoreEntry[];
  isFinalRound: boolean;
  roundNumber: number;
  totalRounds: number;
  players: Map<string, PlayerInfo>;
  matchups: MatchupInfo[];
}

export interface ScoreboardEntry extends ScoreEntry {
  rank: number;
}

export class ResultsViewModel {
  constructor(private readonly manager: GameConnectionManager) {}

  private readonly state = $derived(
    this.manager.stateVersion >= 0
      ? (this.manager.room?.state as ResultsState | undefined)
      : undefined,
  );

  readonly scoreboard = $derived.by((): ScoreboardEntry[] => {
    const entries = this.state?.scoreboard ?? [];
    const sorted = [...entries].sort((a, b) => b.score - a.score);
    let lastScore = Infinity;
    let rank = 0;
    return sorted.map((entry, i) => {
      if (entry.score !== lastScore) {
        rank = i + 1;
        lastScore = entry.score;
      }
      return { ...entry, rank };
    });
  });

  readonly winner = $derived(this.scoreboard.length > 0 ? this.scoreboard[0] : undefined);

  readonly roundNumber = $derived(this.state?.roundNumber ?? 0);
  readonly totalRounds = $derived(this.state?.totalRounds ?? 3);
  readonly isFinalRound = $derived(this.state?.isFinalRound ?? false);

  readonly myEntry = $derived.by((): ScoreboardEntry | undefined => {
    const sessionId = this.manager.room?.sessionId;
    if (!sessionId) return undefined;
    return this.scoreboard.find((e) => e.playerId === sessionId);
  });

  readonly isHost = $derived.by((): boolean => {
    const sessionId = this.manager.room?.sessionId;
    if (!sessionId || !this.state?.players) return false;
    return this.state.players.get(sessionId)?.role === "host";
  });

  readonly roundLabel = $derived(`Round ${this.roundNumber} of ${this.totalRounds}`);

  readonly showNextRound = $derived(this.isHost && !this.isFinalRound);

  readonly showPlayAgain = $derived(this.isHost && this.isFinalRound);

  readonly champion = $derived.by((): ScoreboardEntry | undefined => {
    if (!this.isFinalRound || !this.winner) return undefined;
    return this.winner;
  });

  readonly matchups = $derived(this.state?.matchups ?? []);

  isMe(playerId: string): boolean {
    return this.manager.room?.sessionId === playerId;
  }

  authorName(authorId: string): string {
    if (!this.state?.players) return "Unknown";
    return this.state.players.get(authorId)?.name ?? "Unknown";
  }

  nextRound() {
    this.manager.room?.send("ACTION", { type: "NEXT_ROUND" });
  }

  playAgain() {
    this.manager.room?.send("ACTION", { type: "PLAY_AGAIN" });
  }
}
