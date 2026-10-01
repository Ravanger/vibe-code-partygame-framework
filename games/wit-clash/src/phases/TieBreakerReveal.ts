import { PHASE } from "../phaseNames.js";
import type { WitClashPhase } from "../private.js";
import { Round } from "../round.js";
import { TieBreakerFlow } from "../tieBreakerFlow.js";
import { endGameActions } from "./endGame.js";

export const TieBreakerReveal: WitClashPhase = {
  duration: (ctx) => ctx.options.revealSeconds * 1000,
  onEnter: (ctx) => new TieBreakerFlow(ctx).reveal(),
  onRosterChange: (ctx) => {
    new Round(ctx).endIfTooFewPlayers();
  },
  actions: endGameActions,
  onTimeout: (ctx) =>
    ctx.transition(ctx.priv.tieBreakerPlan ? PHASE.TieBreakerPrompting : PHASE.Results),
};
