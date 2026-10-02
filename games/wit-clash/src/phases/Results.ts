import { ErrorCode } from "@partygame/shared";
import { ACTION, defineAction, NoPayloadSchema } from "../actions.js";
import { PHASE } from "../phaseNames.js";
import type { WitClashPhase } from "../private.js";
import { Round } from "../round.js";

export const Results: WitClashPhase = {
  onEnter: (ctx) => {
    ctx.state.isFinalRound = ctx.state.roundNumber >= ctx.state.totalRounds;
    const round = new Round(ctx);
    round.writeScoreboard();
    if (ctx.state.isFinalRound) round.writeBestAnswers();
  },
  onRosterChange: (ctx) => {
    const round = new Round(ctx);
    round.pruneDeparted();
    round.writeScoreboard();
  },
  actions: {
    [ACTION.NEXT_ROUND]: defineAction({
      from: "host",
      payload: NoPayloadSchema,
      handler: (ctx) => {
        if (ctx.state.isFinalRound) {
          ctx.reject(ErrorCode.NOT_ALLOWED, "That was the final round");
          return;
        }
        ctx.transition(PHASE.CategorySelection);
      },
    }),
    [ACTION.PLAY_AGAIN]: defineAction({
      from: "host",
      payload: NoPayloadSchema,
      handler: (ctx) => ctx.returnToLobby(),
    }),
  },
};
