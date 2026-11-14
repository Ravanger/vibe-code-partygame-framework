import { ensureMine, pruneMine, required, resetMine } from "@partygame/core";
import { countVoted } from "@partygame/core/kits";
import { pickBestAnswers } from "./bestAnswers.js";
import { eligibleVoterIds, seatedActiveIds } from "./eligibility.js";
import { pickHighlights } from "./highlights.js";
import { META } from "./meta.js";
import { PHASE } from "./phaseNames.js";
import type { WitClashContext } from "./private.js";
import { composeScoreboard } from "./scoreboard.js";
import {
  BestAnswer,
  Highlight,
  HighlightAnswer,
  type Matchup,
  PlayerPrivate,
  ScoreEntry,
} from "./state.js";

export const PLACEHOLDER_TEXT = "(no answer)";

/** The lobby notice when a departure drops the room below its minimum. */
export const TOO_FEW_PLAYERS_NOTICE = `Fewer than ${META.minPlayers} players were left, so the game ended.`;

/** A fresh private entry for a player; the create callback every `ensureMine` call site shares. */
export const newPlayerPrivate = (): PlayerPrivate => new PlayerPrivate();

/** Writes the shared rules' results into the synced state. One per hook call; holds no state of its own. */
export class Round {
  constructor(private readonly ctx: WitClashContext) {}

  pruneDeparted(): void {
    const { state } = this.ctx;
    const departed = pruneMine(this.ctx, state.mine, [
      ...state.mine.keys(),
      ...state.progress.keys(),
      ...state.typing.keys(),
    ]);
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

  writeHighlights(): void {
    const { state, priv } = this.ctx;
    state.highlights.clear();
    const picked = pickHighlights(priv.answerHistory);
    for (const list of [picked.biggestMargin, picked.closestMatch, picked.fastestAnswer]) {
      if (list === undefined) continue;
      for (const item of list) {
        const entry = Object.assign(new Highlight(), {
          kind: item.kind,
          promptText: item.promptText,
        });
        for (const answer of item.answers)
          entry.answers.push(Object.assign(new HighlightAnswer(), answer));
        state.highlights.push(entry);
      }
    }
  }

  /** The end of a round: on the final round, the optional honor vote before Results; otherwise straight to Results. */
  toResults(): void {
    const { state } = this.ctx;
    if (state.roundNumber >= state.totalRounds && this.ctx.options.honorVote) {
      this.writeBestAnswers();
      this.writeHighlights();
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

  /** The seated players who may have voted, connected or not; a dropped connection is not a departure. */
  tallyVoterIds(): string[] {
    const matchup = this.activeMatchup();
    return eligibleVoterIds(
      seatedActiveIds(this.ctx.players()),
      this.authorIds(matchup),
      matchup.isForfeit,
    );
  }

  syncVoting(): void {
    const { state, priv } = this.ctx;
    const eligible = this.eligibleVoterIds();
    const authors = new Set(this.authorIds(this.activeMatchup()));
    const active = new Set(this.ctx.activePlayers().map((p) => p.id));
    for (const player of this.ctx.players()) {
      if (!active.has(player.id) && !state.mine.has(player.id)) continue;
      const mine = ensureMine(this.ctx, state.mine, player.id, newPlayerPrivate);
      mine.canVote = eligible.includes(player.id);
      mine.isOwnMatchup = authors.has(player.id);
    }
    state.votesExpected = eligible.length;
    state.votesCast = countVoted(eligible, priv.matchupVotes);
  }

  writeScoreboard(): void {
    const { state, priv } = this.ctx;
    priv.roster.remember(this.ctx);
    const seated = this.ctx.players();
    const rows = composeScoreboard({
      scores: priv.scores,
      awards: priv.roundAwards,
      tieBreakerWinnerId: priv.tieBreakerWinnerId,
      activeIds: seated.filter((p) => p.isActive && p.isReady).map((p) => p.id),
      seatedNames: new Map(seated.map((p) => [p.id, p.name])),
      rememberedNames: priv.roster.rememberedNames,
      participantIds: priv.roster.participantIds,
    });
    state.scoreboard.clear();
    for (const row of rows) state.scoreboard.push(Object.assign(new ScoreEntry(), row));
  }

  clearRound(): void {
    const { state, priv } = this.ctx;
    priv.clearRound();
    resetMine(this.ctx, state.mine);
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
    this.ctx.state.highlights.clear();
    this.ctx.state.awards.clear();
    this.ctx.state.honorWinnerNames.clear();
    this.ctx.state.roundNumber = 0;
    this.ctx.state.totalRounds = this.ctx.options.totalRounds;
    this.ctx.state.rejectedTexts = 0;
  }
}
