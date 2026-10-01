import { ACTION, defineAction, NoPayloadSchema } from "../actions.js";
import type { WitClashPhase } from "../private.js";

export const endGameActions: NonNullable<WitClashPhase["actions"]> = {
  [ACTION.END_GAME]: defineAction({
    from: "host",
    payload: NoPayloadSchema,
    handler: (ctx) => {
      ctx.state.notice = "The host ended the game.";
      ctx.returnToLobby();
    },
  }),
};
