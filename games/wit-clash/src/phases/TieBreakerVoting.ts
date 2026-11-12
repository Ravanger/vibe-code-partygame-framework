import { endIfBelowMinimum, ensureMine } from "@partygame/core";
import { ErrorCode } from "@partygame/shared";
import { ACTION, CastVoteSchema, defineAction } from "../actions.js";
import { META } from "../meta.js";
import { PHASE } from "../phaseNames.js";
import type { WitClashContext, WitClashPhase } from "../private.js";
import { newPlayerPrivate, Round, TOO_FEW_PLAYERS_NOTICE } from "../round.js";
import { TieBreakerFlow } from "../tieBreakerFlow.js";

const revealWhenDone = (ctx: WitClashContext): void => {
  if (ctx.state.votesCast >= ctx.state.votesExpected) ctx.transition(PHASE.TieBreakerReveal);
};

export const TieBreakerVoting: WitClashPhase = {
  duration: (ctx) => ctx.options.voteSeconds * 1000,
  onEnter: (ctx) => {
    new TieBreakerFlow(ctx).startVoting();
    revealWhenDone(ctx);
  },
  onTimeout: (ctx) => ctx.transition(PHASE.TieBreakerReveal),
  onRosterChange: (ctx) => {
    const round = new Round(ctx);
    if (endIfBelowMinimum(ctx, META.minPlayers, TOO_FEW_PLAYERS_NOTICE)) return;
    ctx.priv.roster.remember(ctx);
    round.pruneDeparted();
    const flow = new TieBreakerFlow(ctx);
    if (flow.dropDeparted() || flow.endIfNoVoters()) return;
    flow.syncVoting();
    revealWhenDone(ctx);
  },
  actions: {
    [ACTION.CAST_VOTE]: defineAction({
      from: "player",
      payload: CastVoteSchema,
      handler: (ctx) => {
        const flow = new TieBreakerFlow(ctx);
        const answer = flow.current().answers.find((a) => a.id === ctx.payload.answerId);
        if (!answer) {
          ctx.reject(ErrorCode.INVALID_ACTION, "That answer is not up for a vote");
          return;
        }
        if (!flow.voterIds().includes(ctx.playerId)) {
          ctx.reject(ErrorCode.NOT_ALLOWED, "You cannot vote on this tie-breaker");
          return;
        }
        ctx.priv.matchupVotes.set(ctx.playerId, answer.id);
        ensureMine(ctx, ctx.state.mine, ctx.playerId, newPlayerPrivate).matchupVote = answer.id;
        flow.syncVoting();
        revealWhenDone(ctx);
      },
    }),
  },
};
