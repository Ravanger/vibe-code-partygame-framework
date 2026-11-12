import { endIfBelowMinimum, required } from "@partygame/core";
import { ErrorCode } from "@partygame/shared";
import { ACTION, defineAction, SubmitFakeSchema } from "../actions.js";
import { META } from "../meta.js";
import { PHASE } from "../phaseNames.js";
import { type BluffPhase, FAKE_SLOT } from "../private.js";
import { Round, TOO_FEW_PLAYERS_NOTICE } from "../round.js";

export const Writing: BluffPhase = {
  duration: (ctx) => ctx.options.writingSeconds * 1000,
  onEnter: (ctx) => new Round(ctx).startRound(),
  onTimeout: (ctx) => ctx.transition(PHASE.Voting),
  onRosterChange: (ctx) => {
    const round = new Round(ctx);
    round.pruneDeparted();
    ctx.priv.roster.remember(ctx);
    if (endIfBelowMinimum(ctx, META.minPlayers, TOO_FEW_PLAYERS_NOTICE)) return;
    if (round.writingComplete()) ctx.transition(PHASE.Voting);
  },
  actions: {
    [ACTION.SUBMIT_FAKE]: defineAction({
      from: "player",
      payload: SubmitFakeSchema,
      textFields: ["text"],
      handler: (ctx) => {
        if (ctx.priv.fakes.has(ctx.playerId)) {
          ctx.reject(ErrorCode.NOT_ALLOWED, "You already submitted your answer");
          return;
        }
        const text = ctx.payload.text.toLowerCase();
        const prompt = required(ctx.priv.prompts.byId(ctx.priv.currentPromptId), "current prompt");
        const taken = [...ctx.priv.fakes.values()].some(
          (slots) => required(slots.get(FAKE_SLOT), "stored fake").toLowerCase() === text,
        );
        if (text === prompt.truth.trim().toLowerCase() || taken) {
          ctx.reject(ErrorCode.NOT_ALLOWED, "An answer like that is already on the table");
          return;
        }
        ctx.priv.fakes.set(ctx.playerId, new Map([[FAKE_SLOT, ctx.payload.text]]));
        ctx.state.progress.set(ctx.playerId, true);
        if (new Round(ctx).writingComplete()) ctx.transition(PHASE.Voting);
      },
    }),
  },
};
