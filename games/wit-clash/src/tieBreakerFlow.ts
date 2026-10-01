import { awardPoints } from "@partygame/core";
import { draftsFor } from "./drafts.js";
import { PHASE } from "./phaseNames.js";
import type { WitClashContext } from "./private.js";
import { required } from "./required.js";
import { Round } from "./round.js";
import { shuffle } from "./shuffle.js";
import { Answer, Matchup, PromptAssignment } from "./state.js";
import { countVoted, tallyVotes } from "./tally.js";
import {
  pickTieBreakerPrompt,
  resolveTieBreaker,
  TIE_BREAKER_BONUS,
  tieBreakerVoterIds,
  topScorers,
} from "./tieBreaker.js";

/** The tie-breaker after the final round: who is tied, the prompt, answers, votes and the verdict. */
export class TieBreakerFlow {
  private readonly round: Round;

  constructor(private readonly ctx: WitClashContext) {
    this.round = new Round(ctx);
  }

  afterMatchups(): void {
    const { state, priv } = this.ctx;
    if (state.roundNumber >= state.totalRounds) {
      const standing = this.ctx
        .players()
        .filter((p) => p.isActive && p.isReady)
        .map((p) => p.id);
      const tied = topScorers(priv.scores, standing);
      if (tied.length > 1 && this.plan(tied)) {
        this.ctx.transition(PHASE.TieBreakerPrompting);
        return;
      }
    }
    this.ctx.transition(PHASE.Results);
  }

  current(): Matchup {
    const { tieBreakers } = this.ctx.state;
    return required(tieBreakers[tieBreakers.length - 1], "tie-breaker");
  }

  voterIds(): string[] {
    return this.votersAmong([...this.ctx.state.tieBreakerContenders]);
  }

  /** Ends the tie-breaker as a shared win when nobody outside the tie can vote; true when it did. */
  endIfNoVoters(): boolean {
    if (this.voterIds().length > 0) return false;
    this.round.clearTyping();
    this.ctx.transition(PHASE.Results);
    return true;
  }

  begin(): void {
    const { state, priv } = this.ctx;
    const plan = required(priv.tieBreakerPlan, "tie-breaker plan");
    priv.tieBreakerPlan = undefined;
    this.round.remember();
    const contenders = plan.contenderIds.filter((id) => this.ctx.player(id));
    state.tieBreakerContenders.clear();
    for (const id of contenders) state.tieBreakerContenders.push(id);
    if (contenders.length < 2) {
      this.conclude(contenders);
      return;
    }
    if (this.endIfNoVoters()) return;
    priv.assignments.clear();
    priv.drafts.clear();
    priv.matchupVotes.clear();
    state.progress.clear();
    this.round.clearTyping();
    state.answersPerPlayer = 1;
    const matchup = new Matchup();
    matchup.id = crypto.randomUUID();
    matchup.index = state.tieBreakers.length;
    matchup.promptText = plan.prompt.text;
    state.tieBreakers.push(matchup);
    for (const entry of state.mine.values()) {
      entry.prompts.clear();
      entry.matchupVote = "";
      entry.canVote = false;
      entry.isOwnMatchup = false;
      entry.ownAnswerId = "";
    }
    for (const player of this.ctx.activePlayers()) this.round.mineOf(player.id);
    for (const id of contenders) {
      priv.assignments.set(id, [matchup.id]);
      state.progress.set(id, 0);
      const assignment = new PromptAssignment();
      assignment.matchupId = matchup.id;
      assignment.promptText = matchup.promptText;
      this.round.mineOf(id).prompts.push(assignment);
    }
  }

  finishAnswering(): void {
    const { priv } = this.ctx;
    this.round.clearTyping();
    const matchup = this.current();
    const answers = draftsFor(matchup.id, priv.assignments, priv.drafts).flatMap((entry) => {
      if (entry.text === undefined) return [];
      const answer = new Answer();
      answer.id = crypto.randomUUID();
      answer.text = entry.text;
      priv.authors.set(answer.id, entry.playerId);
      return [answer];
    });
    for (const answer of shuffle(answers, this.ctx.rng)) matchup.answers.push(answer);
    matchup.isForfeit = answers.length === 1;
    if (answers.length === 0) this.ctx.transition(PHASE.Results);
    else this.ctx.transition(matchup.isForfeit ? PHASE.TieBreakerReveal : PHASE.TieBreakerVoting);
  }

  /** Drops contenders who left; true when that ended the tie-breaker. */
  dropDeparted(): boolean {
    const { state, priv } = this.ctx;
    const before = [...state.tieBreakerContenders];
    const remaining = before.filter((id) => this.ctx.player(id));
    if (remaining.length === before.length) return false;
    state.tieBreakerContenders.clear();
    for (const id of remaining) state.tieBreakerContenders.push(id);
    for (const id of before.filter((x) => !remaining.includes(x))) {
      priv.assignments.delete(id);
      priv.drafts.delete(id);
    }
    if (remaining.length >= 2) return false;
    this.conclude(remaining);
    return true;
  }

  startVoting(): void {
    this.ctx.priv.matchupVotes.clear();
    for (const mine of this.ctx.state.mine.values()) mine.matchupVote = "";
    this.syncVoting();
  }

  syncVoting(): void {
    const { state, priv } = this.ctx;
    const eligible = this.voterIds();
    const { answers } = this.current();
    const active = new Set(this.ctx.activePlayers().map((p) => p.id));
    for (const player of this.ctx.players()) {
      if (!active.has(player.id) && !state.mine.has(player.id)) continue;
      const mine = this.round.mineOf(player.id);
      mine.canVote = eligible.includes(player.id);
      mine.isOwnMatchup = state.tieBreakerContenders.includes(player.id);
      mine.ownAnswerId = answers.find((a) => this.round.authorOf(a.id) === player.id)?.id ?? "";
    }
    state.votesExpected = eligible.length;
    state.votesCast = countVoted(eligible, priv.matchupVotes);
  }

  reveal(): void {
    const { state, priv } = this.ctx;
    const matchup = this.current();
    const tally = tallyVotes(matchup.isForfeit ? [] : this.voterIds(), priv.matchupVotes);
    for (const answer of matchup.answers) {
      answer.votes = tally.get(answer.id) ?? 0;
      answer.authorId = this.round.authorOf(answer.id);
    }
    this.round.remember();
    matchup.isRevealed = true;
    state.votesCast = [...tally.values()].reduce((n, v) => n + v, 0);
    const result = resolveTieBreaker([...matchup.answers]);
    for (const answer of matchup.answers) {
      answer.authorName = required(priv.names[answer.authorId], "author name");
      answer.isWinner = answer.authorId === result.winnerId;
    }
    if (result.winnerId !== undefined) this.win(result.winnerId);
    else this.plan(result.leaderIds);
  }

  private votersAmong(contenderIds: readonly string[]): string[] {
    return tieBreakerVoterIds(
      this.ctx.activePlayers().map((p) => p.id),
      contenderIds,
    );
  }

  private plan(contenderIds: string[]): boolean {
    const { priv } = this.ctx;
    if (this.votersAmong(contenderIds).length === 0) return false;
    const prompt = pickTieBreakerPrompt(
      priv.content.all(),
      priv.categoryId,
      priv.usedPromptIds,
      this.ctx.rng,
    );
    if (!prompt) return false;
    priv.usedPromptIds.add(prompt.id);
    priv.tieBreakerPlan = { contenderIds, prompt };
    return true;
  }

  private win(playerId: string): void {
    awardPoints(this.ctx.priv.scores, playerId, TIE_BREAKER_BONUS);
    this.ctx.priv.tieBreakerWinnerId = playerId;
  }

  private conclude(remaining: readonly string[]): void {
    const [only] = remaining;
    if (only !== undefined) this.win(only);
    this.round.clearTyping();
    this.ctx.transition(PHASE.Results);
  }
}
