import { awardPoints, required } from "@partygame/core";
import { PHASE } from "../phaseNames.js";
import type { WitClashContext, WitClashPhase } from "../private.js";
import { Round } from "../round.js";
import { settleMatchup } from "../scoring.js";
import { tallyVotes } from "../tally.js";
import { TieBreakerFlow } from "../tieBreakerFlow.js";

const reveal = (ctx: WitClashContext): void => {
  const { state, priv } = ctx;
  const round = new Round(ctx);
  const matchup = round.activeMatchup();
  const eligible = round.eligibleVoterIds();
  const tally = tallyVotes(eligible, priv.matchupVotes);
  for (const answer of matchup.answers) {
    answer.votes = tally.get(answer.id) ?? 0;
    answer.authorId = round.authorOf(answer.id);
  }
  round.remember();
  matchup.isRevealed = true;
  state.votesCast = [...tally.values()].reduce((n, v) => n + v, 0);
  const awards = settleMatchup(
    matchup.answers.map((a) => ({
      id: a.id,
      authorId: a.authorId,
      votes: a.votes,
      isPlaceholder: priv.placeholders.has(a.id),
    })),
    matchup.isForfeit,
    eligible.length,
  );
  for (const award of awards) {
    if (award.total > 0) awardPoints(priv.scores, award.playerId, award.total);
    priv.roundAwards.push(award);
  }
  for (const answer of matchup.answers) {
    answer.authorName = required(priv.names[answer.authorId], "author name");
    answer.isWinner = awards.some((a) => a.playerId === answer.authorId && a.isWinner);
  }
  matchup.isClash = awards.some((a) => a.isClash);
  if (matchup.isForfeit) return;
  for (const answer of matchup.answers) {
    priv.answerHistory.push({
      text: answer.text,
      authorId: answer.authorId,
      authorName: answer.authorName,
      promptText: matchup.promptText,
      votes: answer.votes,
      matchupVotes: state.votesCast,
    });
  }
};

export const MatchupReveal: WitClashPhase = {
  duration: (ctx) => ctx.options.revealSeconds * 1000,
  onEnter: reveal,
  onRosterChange: (ctx) => {
    new Round(ctx).endIfTooFewPlayers();
  },
  onTimeout: (ctx) => {
    const { activeMatchupIndex, matchups } = ctx.state;
    if (activeMatchupIndex + 1 < matchups.length) ctx.transition(PHASE.MatchupVoting);
    else new TieBreakerFlow(ctx).afterMatchups();
  },
};
