import { endIfBelowMinimum } from "@partygame/core";
import { ACTION, defineAction, NoPayloadSchema } from "../actions.js";
import { META } from "../meta.js";
import type { BluffPhase } from "../private.js";
import { Round, TOO_FEW_PLAYERS_NOTICE } from "../round.js";

export const Results: BluffPhase = {
  onEnter: (ctx) => new Round(ctx).writeScoreboard(),
  onRosterChange: (ctx) => {
    new Round(ctx).pruneDeparted();
    endIfBelowMinimum(ctx, META.minPlayers, TOO_FEW_PLAYERS_NOTICE);
  },
  actions: {
    [ACTION.PLAY_AGAIN]: defineAction({
      from: "host",
      payload: NoPayloadSchema,
      handler: (ctx) => ctx.returnToLobby(),
    }),
  },
};
