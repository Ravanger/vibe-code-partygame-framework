import { endIfBelowMinimum, ensureMine } from "@partygame/core";
import { ErrorCode } from "@partygame/shared";
import { ACTION, CastVoteSchema, defineAction } from "../actions.js";
import { META } from "../meta.js";
import { PHASE } from "../phaseNames.js";
import type { WitClashContext, WitClashPhase } from "../private.js";
import { newPlayerPrivate, Round, TOO_FEW_PLAYERS_NOTICE } from "../round.js";

const revealWhenDone = (ctx: WitClashContext): void => {
  if (ctx.state.votesCast >= ctx.state.votesExpected) ctx.transition(PHASE.MatchupReveal);
};

export const MatchupVoting: WitClashPhase = {
  duration: (ctx) => ctx.options.voteSeconds * 1000,
  onEnter: (ctx) => {
    ++ctx.state.activeMatchupIndex;
    ctx.priv.matchupVotes.clear();
    for (const mine of ctx.state.mine.values()) mine.matchupVote = "";
    new Round(ctx).syncVoting();
    revealWhenDone(ctx);
  },
  onTimeout: (ctx) => ctx.transition(PHASE.MatchupReveal),
  onRosterChange: (ctx) => {
    const round = new Round(ctx);
    if (endIfBelowMinimum(ctx, META.minPlayers, TOO_FEW_PLAYERS_NOTICE)) return;
    ctx.priv.roster.remember(ctx);
    round.pruneDeparted();
    round.syncVoting();
    revealWhenDone(ctx);
  },
  actions: {
    [ACTION.CAST_VOTE]: defineAction({
      from: "player",
      payload: CastVoteSchema,
      handler: (ctx) => {
        const round = new Round(ctx);
        const answer = round.activeMatchup().answers.find((a) => a.id === ctx.payload.answerId);
        if (!answer) {
          ctx.reject(ErrorCode.INVALID_ACTION, "That answer is not up for a vote");
          return;
        }
        if (!round.eligibleVoterIds().includes(ctx.playerId)) {
          ctx.reject(ErrorCode.NOT_ALLOWED, "You cannot vote on this matchup");
          return;
        }
        ctx.priv.matchupVotes.set(ctx.playerId, answer.id);
        ensureMine(ctx, ctx.state.mine, ctx.playerId, newPlayerPrivate).matchupVote = answer.id;
        round.syncVoting();
        revealWhenDone(ctx);
      },
    }),
  },
};
