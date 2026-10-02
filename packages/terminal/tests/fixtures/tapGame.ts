import { type SchemaType, t } from "@colyseus/schema";
import { actionFactory, defineGame } from "@partygame/core";
import { BaseGameState } from "@partygame/shared/schema";
import { z } from "zod";

export const TapState = BaseGameState.extend(
  { taps: t.number().default(0), done: t.boolean().default(false) },
  "TapState",
);
export type TapState = SchemaType<typeof TapState>;

interface TapPrivate {
  tapped: Set<string>;
}

const action = actionFactory<TapState, TapPrivate, Record<string, never>>();

export const TapGame = defineGame<TapState, TapPrivate, Record<string, never>>({
  name: "Tap",
  minPlayers: 2,
  maxPlayers: 6,
  startPhase: "Tap",
  createPrivateState: () => ({ tapped: new Set() }),
  phases: {
    Tap: {
      onEnter: (ctx) => ctx.activateWaitingPlayers(),
      actions: {
        TAP: action({
          from: "player",
          payload: z.object({}),
          handler: (ctx) => {
            ctx.priv.tapped.add(ctx.playerId);
            ctx.state.taps = ctx.priv.tapped.size;
            if (ctx.activePlayers().every((p) => ctx.priv.tapped.has(p.id))) ctx.transition("Done");
          },
        }),
      },
    },
    Done: {
      onEnter: (ctx) => {
        ctx.state.done = true;
      },
    },
  },
});

export const TAP_ROOM = "tap";
