import { isBelowMinimum } from "@partygame/core";
import { ACTION, defineAction, NoPayloadSchema } from "../actions.js";
import { META } from "../meta.js";
import type { RushPhase } from "../private.js";
import { dealTarget, inZone, stepTarget } from "../target.js";

export const Race: RushPhase = {
  duration: (ctx) => ctx.options.raceSeconds * 1000,
  onEnter: (ctx) => {
    const target = dealTarget(ctx.rng);
    ctx.state.targetX = target.x;
    ctx.state.targetY = target.y;
    ctx.priv.vx = target.vx;
    ctx.priv.vy = target.vy;
    ctx.state.taps.clear();
    ctx.state.hits.clear();
  },
  onTick: (ctx, dtMs) => {
    const next = stepTarget(
      { x: ctx.state.targetX, y: ctx.state.targetY, vx: ctx.priv.vx, vy: ctx.priv.vy },
      dtMs,
    );
    ctx.state.targetX = next.x;
    ctx.state.targetY = next.y;
    ctx.priv.vx = next.vx;
    ctx.priv.vy = next.vy;
  },
  onTimeout: (ctx) => ctx.transition("Results"),
  onRosterChange: (ctx) => {
    if (!isBelowMinimum(ctx, META.minPlayers)) return;
    ctx.state.notice = "Fewer than 2 players were left, so the race ended.";
    ctx.returnToLobby();
  },
  actions: {
    [ACTION.TAP]: defineAction({
      from: "player",
      payload: NoPayloadSchema,
      handler: (ctx) => {
        const taps = ctx.state.taps;
        taps.set(ctx.playerId, (taps.get(ctx.playerId) ?? 0) + 1);
        if (!inZone(ctx.state.targetX, ctx.state.targetY)) return;
        const hits = ctx.state.hits;
        hits.set(ctx.playerId, (hits.get(ctx.playerId) ?? 0) + 1);
      },
    }),
  },
};
