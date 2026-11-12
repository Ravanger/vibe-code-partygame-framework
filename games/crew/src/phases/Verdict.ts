import { endIfBelowMinimum } from "@partygame/core";
import { ACTION, defineAction, GuessSchema } from "../actions.js";
import { Crew, TOO_FEW_PLAYERS_NOTICE } from "../crew.js";
import { META } from "../meta.js";
import type { CrewPhase } from "../private.js";

const DURATION = 30_000;

export const Verdict: CrewPhase = {
  duration: DURATION,
  onTimeout: (ctx) => new Crew(ctx).finishGame(false),
  onRosterChange: (ctx) => {
    new Crew(ctx).pruneDeparted();
    endIfBelowMinimum(ctx, META.minPlayers, TOO_FEW_PLAYERS_NOTICE);
  },
  actions: {
    [ACTION.GUESS]: defineAction({
      from: "player",
      payload: GuessSchema,
      handler: (ctx) => new Crew(ctx).guess(ctx.playerId, ctx.payload.value),
    }),
  },
};
