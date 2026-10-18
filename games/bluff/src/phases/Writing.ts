import { ErrorCode } from "@partygame/shared";
import { ACTION, defineAction, SubmitFakeSchema } from "../actions.js";
import { PHASE } from "../phaseNames.js";
import { type BluffPhase, FAKE_SLOT } from "../private.js";
import { Round } from "../round.js";

export const Writing: BluffPhase = {
  duration: 45_000,
  onEnter: (ctx) => new Round(ctx).startRound(),
  onTimeout: (ctx) => ctx.transition(PHASE.Voting),
  onRosterChange: (ctx) => {
    const round = new Round(ctx);
    round.pruneDeparted();
    if (round.endIfTooFewPlayers()) return;
    if (round.writingComplete()) ctx.transition(PHASE.Voting);
  },
  actions: {
    [ACTION.SUBMIT_FAKE]: defineAction({
      from: "player",
      payload: SubmitFakeSchema,
      handler: (ctx) => {
        if (ctx.priv.fakes.has(ctx.playerId)) {
          ctx.reject(ErrorCode.NOT_ALLOWED, "You already submitted your answer");
          return;
        }
        ctx.priv.fakes.set(ctx.playerId, new Map([[FAKE_SLOT, ctx.payload.text]]));
        ctx.state.progress.set(ctx.playerId, true);
        if (new Round(ctx).writingComplete()) ctx.transition(PHASE.Voting);
      },
    }),
  },
};
