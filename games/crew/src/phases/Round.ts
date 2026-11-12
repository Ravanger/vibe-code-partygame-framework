import { EmptyPayloadSchema, endIfBelowMinimum } from "@partygame/core";
import { ErrorCode } from "@partygame/shared";
import { ACTION, defineAction } from "../actions.js";
import { Crew, TOO_FEW_PLAYERS_NOTICE } from "../crew.js";
import { META } from "../meta.js";
import type { CrewPhase } from "../private.js";

const DURATION = 20_000;

export const Round: CrewPhase = {
  duration: DURATION,
  onEnter: (ctx) => {
    ctx.priv.roster.remember(ctx);
    if (ctx.state.round === 0) new Crew(ctx).deal();
    ++ctx.state.round;
    ctx.priv.clearRound();
    ctx.state.choices.clear();
  },
  onTimeout: (ctx) => new Crew(ctx).advance(),
  onRosterChange: (ctx) => {
    const crew = new Crew(ctx);
    crew.pruneDeparted();
    if (endIfBelowMinimum(ctx, META.minPlayers, TOO_FEW_PLAYERS_NOTICE)) return;
    if (crew.roundComplete()) crew.advance();
  },
  actions: {
    [ACTION.SHARE]: defineAction({
      from: "player",
      payload: EmptyPayloadSchema,
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
      payload: EmptyPayloadSchema,
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
