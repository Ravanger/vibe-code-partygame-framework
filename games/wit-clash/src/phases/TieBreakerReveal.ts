import { endIfBelowMinimum } from "@partygame/core";
import { META } from "../meta.js";
import { PHASE } from "../phaseNames.js";
import type { WitClashPhase } from "../private.js";
import { Round, TOO_FEW_PLAYERS_NOTICE } from "../round.js";
import { TieBreakerFlow } from "../tieBreakerFlow.js";

export const TieBreakerReveal: WitClashPhase = {
  duration: (ctx) => ctx.options.revealSeconds * 1000,
  onEnter: (ctx) => new TieBreakerFlow(ctx).reveal(),
  onRosterChange: (ctx) => {
    endIfBelowMinimum(ctx, META.minPlayers, TOO_FEW_PLAYERS_NOTICE);
  },
  onTimeout: (ctx) => {
    if (ctx.priv.tieBreakerPlan) ctx.transition(PHASE.TieBreakerPrompting);
    else new Round(ctx).toResults();
  },
};
