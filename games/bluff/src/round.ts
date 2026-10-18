import {
  awardPoints,
  composeLeaderboard,
  departedIds,
  isBelowMinimum,
  required,
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

/** Writes the shared rules' results into the synced state. One per hook call; holds no state of its own. */
export class Round {
  constructor(private readonly ctx: BluffContext) {}

  remember(): void {
    for (const player of this.ctx.players()) {
      if (player.name) this.ctx.priv.names[player.id] = player.name;
      if (player.isActive && player.isReady) this.ctx.priv.participants.add(player.id);
    }
  }

  nameOf(playerId: string): string {
    return this.ctx.player(playerId)?.name ?? this.ctx.priv.names[playerId] ?? "";
  }

  /** Creates the player's private entry and reveals it to them. */
  mineOf(playerId: string): PlayerPrivate {
    const created = new PlayerPrivate();
    this.ctx.state.mine.set(playerId, created);
    this.ctx.showTo(playerId, created);
    return created;
  }

  resetMine(): void {
    for (const [playerId, entry] of this.ctx.state.mine) this.ctx.hideFrom(playerId, entry);
    this.ctx.state.mine.clear();
  }

  /** Drops the data of players who left for good; a dropped connection is not a departure. */
  pruneDeparted(): void {
    const { state, priv } = this.ctx;
    const departed = new Set(
      departedIds([...state.mine.keys(), ...state.progress.keys()], this.ctx),
    );
    for (const [playerId, entry] of [...state.mine]) {
      if (!departed.has(playerId)) continue;
      this.ctx.hideFrom(playerId, entry);
      state.mine.delete(playerId);
    }
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
    if (state.roundNumber === 0) state.totalRounds = this.ctx.options.rounds;
    ++state.roundNumber;
    priv.clearRound();
    state.choices.clear();
    state.truthRevealedId = "";
    state.votesCast = 0;
    state.votesExpected = 0;
    state.progress.clear();
    state.results.clear();
    this.resetMine();
    this.drawPrompt();
  }

  activeIds(): string[] {
    return this.ctx.activePlayers().map((p) => p.id);
  }

  /** One slot per active player, all for the fake answer. */
  slots(): Map<string, readonly string[]> {
    return new Map(this.activeIds().map((id) => [id, [FAKE_SLOT]]));
  }

  writingComplete(): boolean {
    return allResponded(this.slots(), this.ctx.priv.fakes, new Set(this.activeIds()));
  }

  /** Shuffles the truth with every submitted fake and reveals each player's own option privately. */
  buildOptions(): void {
    const { state, priv } = this.ctx;
    const prompt = required(priv.prompts.byId(priv.currentPromptId), "current prompt");
    const fakes: { text: string; authorId: string }[] = [];
    for (const entry of entriesFor(FAKE_SLOT, this.slots(), priv.fakes)) {
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
      this.mineOf(playerId).myOptionId = own?.id ?? "";
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
    this.remember();
    const counts = tallyVotes([...priv.votes.keys()], priv.votes);
    for (const option of state.choices) {
      option.votes = counts.get(option.id) ?? 0;
      const authorId = required(priv.optionAuthor.get(option.id), "option author");
      option.authorName = authorId === "" ? "The game" : this.nameOf(authorId);
    }
    state.truthRevealedId = priv.truthOptionId;
    state.results.clear();
    for (const award of settleRound(priv.votes, priv.truthOptionId, priv.optionAuthor)) {
      awardPoints(priv.scores, award.playerId, award.points);
      state.results.push(
        Object.assign(new RevealEntry(), {
          playerId: award.playerId,
          name: this.nameOf(award.playerId),
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
    this.remember();
    const seated = this.ctx.players();
    const rows = composeLeaderboard({
      scores: priv.scores,
      seatedNames: new Map(seated.map((p) => [p.id, p.name])),
      rememberedNames: priv.names,
      ids: [...priv.participants],
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

  endIfTooFewPlayers(): boolean {
    if (!isBelowMinimum(this.ctx, META.minPlayers)) return false;
    this.ctx.state.notice = `Fewer than ${META.minPlayers} players were left, so the game ended.`;
    this.ctx.returnToLobby();
    return true;
  }

  /** Clears everything for a fresh game after returning to the lobby. */
  clearGame(): void {
    const { state } = this.ctx;
    this.ctx.priv.clearGame();
    this.resetMine();
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
