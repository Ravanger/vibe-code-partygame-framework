import { ACTION, defineAction, NoPayloadSchema } from "../actions.js";
import type { __PascalName__Context, __PascalName__Phase } from "../private.js";

const writeWinner = (ctx: __PascalName__Context): void => {
  let winnerName = "";
  let best = 0;
  for (const player of ctx.activePlayers()) {
    const waves = ctx.state.waves.get(player.id) ?? 0;
    if (waves > best) {
      best = waves;
      winnerName = player.name;
    }
  }
  ctx.state.winnerWaves = best;
  ctx.state.winnerName = winnerName;
};

export const Results: __PascalName__Phase = {
  onEnter: writeWinner,
  actions: {
    [ACTION.PLAY_AGAIN]: defineAction({
      from: "host",
      payload: NoPayloadSchema,
      handler: (ctx) => ctx.returnToLobby(),
    }),
  },
};
