import { PHASE } from "../phaseNames.js";
import type { BluffPhase } from "../private.js";
import { Round } from "../round.js";

export const Reveal: BluffPhase = {
  duration: (ctx) => ctx.options.revealSeconds * 1000,
  onEnter: (ctx) => new Round(ctx).writeReveal(),
  onTimeout: (ctx) => {
    ctx.transition(ctx.state.roundNumber >= ctx.state.totalRounds ? PHASE.Results : PHASE.Writing);
  },
};
