import {
  awardPoints,
  composeLeaderboard,
  ensureMine,
  pruneMine,
  required,
  resetMine,
  shuffle,
} from "@partygame/core";
import {
  allHaveVoted,
  allResponded,
  countVoted,
  drawPool,
  entriesFor,
  tallyVotes,
} from "@partygame/core/kits";
import { META } from "./meta.js";
import { type BluffContext, FAKE_SLOT } from "./private.js";
import { settleRound } from "./scoring.js";
import { BluffOption, PlayerPrivate, RevealEntry, ScoreEntry } from "./state.js";

/** The lobby notice when a departure drops the room below its minimum. */
export const TOO_FEW_PLAYERS_NOTICE = `Fewer than ${META.minPlayers} players were left, so the game ended.`;

/** A fresh private entry for a player; the create callback every `ensureMine` call site shares. */
export const newPlayerPrivate = (): PlayerPrivate => new PlayerPrivate();

/** Writes the shared rules' results into the synced state. One per hook call; holds no state of its own. */
export class Round {
  constructor(private readonly ctx: BluffContext) {}

  /** Drops the data of players who left for good; a dropped connection is not a departure. */
  pruneDeparted(): void {
    const { state, priv } = this.ctx;
    const departed = pruneMine(this.ctx, state.mine, [
      ...state.mine.keys(),
      ...state.progress.keys(),
    ]);
    for (const playerId of departed) {
      state.progress.delete(playerId);
      priv.fakes.delete(playerId);
      priv.votes.delete(playerId);
    }
  }

  /** Draws the next unused prompt; the pool wraps around when exhausted. */
  drawPrompt(): void {
    const { items } = drawPool(this.ctx.priv.prompts.all(), this.ctx.priv.usedPromptIds, 1);
    const prompt = required(items[0], "drawn prompt");
    this.ctx.priv.usedPromptIds.add(prompt.id);
    this.ctx.priv.currentPromptId = prompt.id;
    this.ctx.state.promptText = prompt.question;
  }

  startRound(): void {
    const { state, priv } = this.ctx;
    priv.roster.remember(this.ctx);
    if (state.roundNumber === 0) state.totalRounds = this.ctx.options.rounds;
    ++state.roundNumber;
    priv.clearRound();
    state.choices.clear();
    state.truthRevealedId = "";
    state.votesCast = 0;
    state.votesExpected = 0;
    state.progress.clear();
    state.results.clear();
    resetMine(this.ctx, state.mine);
    this.drawPrompt();
  }

  activeIds(): string[] {
    return this.ctx.activePlayers().map((p) => p.id);
  }

  /** One slot per active player, all for the fake answer. */
  slots(): Map<string, readonly string[]> {
    return new Map(this.activeIds().map((id) => [id, [FAKE_SLOT]]));
  }

  /** One slot per seated, ready, active player, connected or not, all for the fake answer. */
  seatedSlots(): Map<string, readonly string[]> {
    return new Map(
      this.ctx
        .players()
        .filter((p) => p.isActive && p.isReady)
        .map((p) => [p.id, [FAKE_SLOT]]),
    );
  }

  writingComplete(): boolean {
    return allResponded(this.slots(), this.ctx.priv.fakes, new Set(this.activeIds()));
  }

  /** True once at least one player has stored a fake answer for this round. */
  hasFakes(): boolean {
    return this.ctx.priv.fakes.size > 0;
  }

  /** Shuffles the truth with every submitted fake and reveals each player's own option privately. */
  buildOptions(): void {
    const { state, priv } = this.ctx;
    const prompt = required(priv.prompts.byId(priv.currentPromptId), "current prompt");
    const fakes: { text: string; authorId: string }[] = [];
    for (const entry of entriesFor(FAKE_SLOT, this.seatedSlots(), priv.fakes)) {
      if (entry.text !== undefined) fakes.push({ text: entry.text, authorId: entry.playerId });
    }
    const raw = [...fakes, { text: prompt.truth, authorId: "" }];
    for (const entry of shuffle(raw, this.ctx.rng)) {
      const id = this.ctx.newId();
      priv.optionAuthor.set(id, entry.authorId);
      if (entry.authorId === "") priv.truthOptionId = id;
      state.choices.push(Object.assign(new BluffOption(), { id, text: entry.text }));
    }
    for (const playerId of this.activeIds()) {
      const own = state.choices.find((o) => priv.optionAuthor.get(o.id) === playerId);
      ensureMine(this.ctx, state.mine, playerId, newPlayerPrivate).myOptionId = own?.id ?? "";
    }
  }

  syncVoting(): void {
    const ids = this.activeIds();
    this.ctx.state.votesExpected = ids.length;
    this.ctx.state.votesCast = countVoted(ids, this.ctx.priv.votes);
  }

  votingComplete(): boolean {
    return allHaveVoted(this.activeIds(), this.ctx.priv.votes);
  }

  /** Reveals the truth and authorship, settles the round's points and writes the scoreboard. */
  writeReveal(): void {
    const { state, priv } = this.ctx;
    priv.roster.remember(this.ctx);
    const counts = tallyVotes([...priv.votes.keys()], priv.votes);
    for (const option of state.choices) {
      option.votes = counts.get(option.id) ?? 0;
      const authorId = required(priv.optionAuthor.get(option.id), "option author");
      option.authorName = authorId === "" ? "The game" : priv.roster.nameOf(this.ctx, authorId);
    }
    state.truthRevealedId = priv.truthOptionId;
    state.results.clear();
    for (const award of settleRound(priv.votes, priv.truthOptionId, priv.optionAuthor)) {
      awardPoints(priv.scores, award.playerId, award.points);
      state.results.push(
        Object.assign(new RevealEntry(), {
          playerId: award.playerId,
          name: priv.roster.nameOf(this.ctx, award.playerId),
          roundPoints: award.points,
          fooledCount: award.fooledCount,
          guessedTruth: award.guessedTruth,
        }),
      );
    }
    this.writeScoreboard();
  }

  writeScoreboard(): void {
    const { state, priv } = this.ctx;
    priv.roster.remember(this.ctx);
    const seated = this.ctx.players();
    const rows = composeLeaderboard({
      scores: priv.scores,
      seatedNames: new Map(seated.map((p) => [p.id, p.name])),
      rememberedNames: priv.roster.rememberedNames,
      ids: priv.roster.participantIds,
    });
    state.scoreboard.clear();
    for (const row of rows) {
      state.scoreboard.push(
        Object.assign(new ScoreEntry(), {
          playerId: row.playerId,
          name: row.name,
          score: row.score,
          hasLeft: row.hasLeft,
        }),
      );
    }
  }

  /** Clears everything for a fresh game after returning to the lobby. */
  clearGame(): void {
    const { state } = this.ctx;
    this.ctx.priv.clearGame();
    resetMine(this.ctx, state.mine);
    state.promptText = "";
    state.roundNumber = 0;
    state.totalRounds = this.ctx.options.rounds;
    state.choices.clear();
    state.truthRevealedId = "";
    state.votesCast = 0;
    state.votesExpected = 0;
    state.progress.clear();
    state.results.clear();
    state.scoreboard.clear();
  }
}
