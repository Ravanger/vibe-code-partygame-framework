import { ACTION, defineAction, NoPayloadSchema } from "../actions.js";
import type { RushPhase } from "../private.js";
import { ScoreEntry } from "../state.js";

export const Results: RushPhase = {
  onEnter: (ctx) => {
    const rows = ctx
      .players()
      .map((player) => ({
        playerId: player.id,
        name: player.name,
        hits: ctx.state.hits.get(player.id) ?? 0,
      }))
      .sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name));
    ctx.state.entries.clear();
    for (const row of rows) {
      const entry = new ScoreEntry();
      entry.playerId = row.playerId;
      entry.name = row.name;
      entry.hits = row.hits;
      ctx.state.entries.push(entry);
    }
  },
  actions: {
    [ACTION.PLAY_AGAIN]: defineAction({
      from: "host",
      payload: NoPayloadSchema,
      handler: (ctx) => ctx.returnToLobby(),
    }),
  },
};
