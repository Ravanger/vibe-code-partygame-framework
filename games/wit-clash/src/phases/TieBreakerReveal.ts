import { PHASE } from "../phaseNames.js";
import type { WitClashPhase } from "../private.js";
import { Round } from "../round.js";
import { TieBreakerFlow } from "../tieBreakerFlow.js";

export const TieBreakerReveal: WitClashPhase = {
  duration: (ctx) => ctx.options.revealSeconds * 1000,
  onEnter: (ctx) => new TieBreakerFlow(ctx).reveal(),
  onRosterChange: (ctx) => {
    new Round(ctx).endIfTooFewPlayers();
  },
  onTimeout: (ctx) => {
    if (ctx.priv.tieBreakerPlan) ctx.transition(PHASE.TieBreakerPrompting);
    else new Round(ctx).toResults();
  },
};
