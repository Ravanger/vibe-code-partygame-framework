import { ACTION, defineAction, NoPayloadSchema } from "../actions.js";
import type { BluffPhase } from "../private.js";
import { Round } from "../round.js";

export const Results: BluffPhase = {
  onEnter: (ctx) => new Round(ctx).writeScoreboard(),
  actions: {
    [ACTION.PLAY_AGAIN]: defineAction({
      from: "host",
      payload: NoPayloadSchema,
      handler: (ctx) => ctx.returnToLobby(),
    }),
  },
};
