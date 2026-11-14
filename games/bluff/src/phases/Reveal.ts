import { endIfBelowMinimum } from "@partygame/core";
import { META } from "../meta.js";
import { PHASE } from "../phaseNames.js";
import type { BluffPhase } from "../private.js";
import { Round, TOO_FEW_PLAYERS_NOTICE } from "../round.js";

export const Reveal: BluffPhase = {
  duration: (ctx) => ctx.options.revealSeconds * 1000,
  onEnter: (ctx) => new Round(ctx).writeReveal(),
  onRosterChange: (ctx) => {
    new Round(ctx).pruneDeparted();
    endIfBelowMinimum(ctx, META.minPlayers, TOO_FEW_PLAYERS_NOTICE);
  },
  onTimeout: (ctx) => {
    ctx.transition(ctx.state.roundNumber >= ctx.state.totalRounds ? PHASE.Results : PHASE.Writing);
  },
};
