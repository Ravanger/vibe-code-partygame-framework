import { ACTION, defineAction, NoPayloadSchema } from "../actions.js";
import type { CrewPhase } from "../private.js";

export const Results: CrewPhase = {
  actions: {
    [ACTION.PLAY_AGAIN]: defineAction({
      from: "host",
      payload: NoPayloadSchema,
      handler: (ctx) => ctx.returnToLobby(),
    }),
  },
};
