import { ACTION, defineAction, GuessSchema } from "../actions.js";
import { Crew } from "../crew.js";
import type { CrewPhase } from "../private.js";

const DURATION = 30_000;

export const Verdict: CrewPhase = {
  duration: DURATION,
  onTimeout: (ctx) => new Crew(ctx).finishGame(false),
  onRosterChange: (ctx) => {
    const crew = new Crew(ctx);
    crew.pruneDeparted();
    crew.endIfTooFewPlayers();
  },
  actions: {
    [ACTION.GUESS]: defineAction({
      from: "player",
      payload: GuessSchema,
      handler: (ctx) => new Crew(ctx).guess(ctx.playerId, ctx.payload.value),
    }),
  },
};
