import { EmptyPayloadSchema } from "@partygame/core";
import { ACTION, defineAction } from "../actions.js";
import { PHASE } from "../phaseNames.js";
import type { __PascalName__Phase } from "../private.js";

export const Waving: __PascalName__Phase = {
  onEnter: (ctx) => {
    ctx.state.waves.clear();
    ctx.state.winnerName = "";
    ctx.state.winnerWaves = 0;
  },
  actions: {
    [ACTION.WAVE]: defineAction({
      from: "player",
      payload: EmptyPayloadSchema,
      handler: (ctx) => {
        const waves = (ctx.state.waves.get(ctx.playerId) ?? 0) + 1;
        ctx.state.waves.set(ctx.playerId, waves);
        if (waves >= ctx.options.waveGoal) ctx.transition(PHASE.Results);
      },
    }),
    [ACTION.FINISH]: defineAction({
      from: "host",
      payload: EmptyPayloadSchema,
      handler: (ctx) => ctx.transition(PHASE.Results),
    }),
  },
};
