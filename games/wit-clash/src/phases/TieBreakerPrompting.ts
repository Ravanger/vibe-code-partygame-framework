import { endIfBelowMinimum } from "@partygame/core";
import { META } from "../meta.js";
import type { WitClashPhase } from "../private.js";
import { Round, TOO_FEW_PLAYERS_NOTICE } from "../round.js";
import { TieBreakerFlow } from "../tieBreakerFlow.js";
import { answeringActions, answersComplete } from "./answering.js";

export const TieBreakerPrompting: WitClashPhase = {
  duration: (ctx) => ctx.options.promptSeconds * 1000,
  onEnter: (ctx) => new TieBreakerFlow(ctx).begin(),
  onTimeout: (ctx) => new TieBreakerFlow(ctx).finishAnswering(),
  onRosterChange: (ctx) => {
    const round = new Round(ctx);
    if (endIfBelowMinimum(ctx, META.minPlayers, TOO_FEW_PLAYERS_NOTICE)) return;
    ctx.priv.roster.remember(ctx);
    round.pruneDeparted();
    const flow = new TieBreakerFlow(ctx);
    if (flow.dropDeparted() || flow.endIfNoVoters()) return;
    if (answersComplete(ctx)) flow.finishAnswering();
  },
  actions: answeringActions((ctx) => new TieBreakerFlow(ctx).finishAnswering()),
};
