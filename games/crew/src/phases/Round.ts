import { ErrorCode } from "@partygame/shared";
import { ACTION, defineAction, NoPayloadSchema } from "../actions.js";
import { Crew } from "../crew.js";
import type { CrewPhase } from "../private.js";

const DURATION = 20_000;

export const Round: CrewPhase = {
  duration: DURATION,
  onEnter: (ctx) => {
    const crew = new Crew(ctx);
    crew.remember();
    if (ctx.state.round === 0) crew.deal();
    ++ctx.state.round;
    ctx.priv.clearRound();
    ctx.state.choices.clear();
  },
  onTimeout: (ctx) => new Crew(ctx).advance(),
  onRosterChange: (ctx) => {
    const crew = new Crew(ctx);
    crew.pruneDeparted();
    if (crew.endIfTooFewPlayers()) return;
    if (crew.roundComplete()) crew.advance();
  },
  actions: {
    [ACTION.SHARE]: defineAction({
      from: "player",
      payload: NoPayloadSchema,
      handler: (ctx) => {
        if (ctx.priv.responses.has(ctx.playerId)) {
          ctx.reject(ErrorCode.NOT_ALLOWED, "You already chose this round");
          return;
        }
        const crew = new Crew(ctx);
        crew.recordChoice(ctx.playerId, "share");
        if (crew.roundComplete()) crew.advance();
      },
    }),
    [ACTION.HOLD]: defineAction({
      from: "player",
      payload: NoPayloadSchema,
      handler: (ctx) => {
        if (ctx.priv.responses.has(ctx.playerId)) {
          ctx.reject(ErrorCode.NOT_ALLOWED, "You already chose this round");
          return;
        }
        const crew = new Crew(ctx);
        crew.recordChoice(ctx.playerId, "hold");
        if (crew.roundComplete()) crew.advance();
      },
    }),
  },
};
