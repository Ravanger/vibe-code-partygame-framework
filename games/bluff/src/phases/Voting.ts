import { ErrorCode } from "@partygame/shared";
import { ACTION, CastVoteSchema, defineAction } from "../actions.js";
import { PHASE } from "../phaseNames.js";
import type { BluffPhase } from "../private.js";
import { Round } from "../round.js";

export const Voting: BluffPhase = {
  duration: 30_000,
  onEnter: (ctx) => {
    const round = new Round(ctx);
    round.buildOptions();
    round.syncVoting();
  },
  onTimeout: (ctx) => ctx.transition(PHASE.Reveal),
  onRosterChange: (ctx) => {
    const round = new Round(ctx);
    round.pruneDeparted();
    if (round.endIfTooFewPlayers()) return;
    round.syncVoting();
    if (round.votingComplete()) ctx.transition(PHASE.Reveal);
  },
  actions: {
    [ACTION.CAST_VOTE]: defineAction({
      from: "player",
      payload: CastVoteSchema,
      handler: (ctx) => {
        const { optionId } = ctx.payload;
        if (!ctx.state.choices.some((o) => o.id === optionId)) {
          ctx.reject(ErrorCode.NOT_ALLOWED, "Unknown option");
          return;
        }
        if (ctx.priv.optionAuthor.get(optionId) === ctx.playerId) {
          ctx.reject(ErrorCode.NOT_ALLOWED, "You cannot vote for your own answer");
          return;
        }
        if (ctx.priv.votes.has(ctx.playerId)) {
          ctx.reject(ErrorCode.NOT_ALLOWED, "You already voted");
          return;
        }
        ctx.priv.votes.set(ctx.playerId, optionId);
        const round = new Round(ctx);
        round.syncVoting();
        if (round.votingComplete()) ctx.transition(PHASE.Reveal);
      },
    }),
  },
};
