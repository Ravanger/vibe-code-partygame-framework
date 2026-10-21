import { departedIds, isBelowMinimum, required } from "@partygame/core";
import { countVoted } from "@partygame/core/kits";
import { pickBestAnswers } from "./bestAnswers.js";
import { eligibleVoterIds } from "./eligibility.js";
import { META } from "./meta.js";
import { PHASE } from "./phaseNames.js";
import type { WitClashContext } from "./private.js";
import { composeScoreboard } from "./scoreboard.js";
import { BestAnswer, type Matchup, PlayerPrivate, ScoreEntry } from "./state.js";

export const PLACEHOLDER_TEXT = "(no answer)";

/** Writes the shared rules' results into the synced state. One per hook call; holds no state of its own. */
export class Round {
  constructor(private readonly ctx: WitClashContext) {}

  remember(): void {
    for (const player of this.ctx.players()) {
      if (player.name) this.ctx.priv.names[player.id] = player.name;
      if (player.isActive && player.isReady) this.ctx.priv.participants.add(player.id);
    }
  }

  mineOf(playerId: string): PlayerPrivate {
    const existing = this.ctx.state.mine.get(playerId);
    if (existing) return existing;
    const created = new PlayerPrivate();
    this.ctx.state.mine.set(playerId, created);
    this.ctx.showTo(playerId, created);
    return created;
  }

  resetMine(): void {
    for (const [playerId, entry] of this.ctx.state.mine) this.ctx.hideFrom(playerId, entry);
    this.ctx.state.mine.clear();
  }

  pruneDeparted(): void {
    const { state } = this.ctx;
    const departed = new Set(
      departedIds(
        [...state.mine.keys(), ...state.progress.keys(), ...state.typing.keys()],
        this.ctx,
      ),
    );
    for (const [playerId, entry] of [...state.mine]) {
      if (!departed.has(playerId)) continue;
      this.ctx.hideFrom(playerId, entry);
      state.mine.delete(playerId);
    }
    for (const playerId of departed) {
      state.progress.delete(playerId);
      state.typing.delete(playerId);
    }
  }

  clearTyping(): void {
    this.ctx.state.typing.clear();
  }

  writeBestAnswers(): void {
    const { state, priv } = this.ctx;
    state.bestAnswers.clear();
    for (const record of pickBestAnswers(priv.answerHistory)) {
      const { text, authorId, authorName, promptText, votes } = record;
      state.bestAnswers.push(
        Object.assign(new BestAnswer(), { text, authorId, authorName, promptText, votes }),
      );
    }
  }

  /** The end of a round: on the final round, the optional honor vote before Results; otherwise straight to Results. */
  toResults(): void {
    const { state } = this.ctx;
    if (state.roundNumber >= state.totalRounds && this.ctx.options.honorVote) {
      this.writeBestAnswers();
      if (state.bestAnswers.length > 0) {
        this.ctx.transition(PHASE.HonorVote);
        return;
      }
    }
    this.ctx.transition(PHASE.Results);
  }

  activeMatchup(): Matchup {
    return required(this.ctx.state.matchups[this.ctx.state.activeMatchupIndex], "active matchup");
  }

  authorOf(answerId: string): string {
    return required(this.ctx.priv.authors.get(answerId), "answer author");
  }

  authorIds(matchup: Matchup): string[] {
    return matchup.answers.map((a) => this.authorOf(a.id));
  }

  eligibleVoterIds(): string[] {
    const matchup = this.activeMatchup();
    const activeIds = this.ctx.activePlayers().map((p) => p.id);
    return eligibleVoterIds(activeIds, this.authorIds(matchup), matchup.isForfeit);
  }

  syncVoting(): void {
    const { state, priv } = this.ctx;
    const eligible = this.eligibleVoterIds();
    const authors = new Set(this.authorIds(this.activeMatchup()));
    const active = new Set(this.ctx.activePlayers().map((p) => p.id));
    for (const player of this.ctx.players()) {
      if (!active.has(player.id) && !state.mine.has(player.id)) continue;
      const mine = this.mineOf(player.id);
      mine.canVote = eligible.includes(player.id);
      mine.isOwnMatchup = authors.has(player.id);
    }
    state.votesExpected = eligible.length;
    state.votesCast = countVoted(eligible, priv.matchupVotes);
  }

  writeScoreboard(): void {
    const { state, priv } = this.ctx;
    this.remember();
    const seated = this.ctx.players();
    const rows = composeScoreboard({
      scores: priv.scores,
      awards: priv.roundAwards,
      tieBreakerWinnerId: priv.tieBreakerWinnerId,
      activeIds: seated.filter((p) => p.isActive && p.isReady).map((p) => p.id),
      seatedNames: new Map(seated.map((p) => [p.id, p.name])),
      rememberedNames: priv.names,
      participantIds: [...priv.participants],
    });
    state.scoreboard.clear();
    for (const row of rows) state.scoreboard.push(Object.assign(new ScoreEntry(), row));
  }

  endIfTooFewPlayers(): boolean {
    if (!isBelowMinimum(this.ctx, META.minPlayers)) return false;
    this.ctx.state.notice = `Fewer than ${META.minPlayers} players were left, so the game ended.`;
    this.ctx.returnToLobby();
    return true;
  }

  clearRound(): void {
    const { state, priv } = this.ctx;
    priv.clearRound();
    this.resetMine();
    state.selectedCategory = "";
    state.categoryOptions.clear();
    state.matchups.clear();
    state.scoreboard.clear();
    state.progress.clear();
    state.typing.clear();
    state.tieBreakers.clear();
    state.tieBreakerContenders.clear();
    state.answersPerPlayer = 0;
    state.activeMatchupIndex = -1;
    state.votesCast = 0;
    state.votesExpected = 0;
    state.isFinalRound = false;
  }

  clearGame(): void {
    this.clearRound();
    this.ctx.priv.clearGame();
    this.ctx.state.bestAnswers.clear();
    this.ctx.state.awards.clear();
    this.ctx.state.honorWinnerNames.clear();
    this.ctx.state.roundNumber = 0;
    this.ctx.state.totalRounds = this.ctx.options.totalRounds;
    this.ctx.state.rejectedTexts = 0;
  }
}
