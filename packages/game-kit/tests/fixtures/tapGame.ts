import { type SchemaType, t } from "@colyseus/schema";
import type { BotKit, BotStrategy } from "@partygame/bots";
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
  version: "1",
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

/** Taps once when the tap phase is live. */
const tapStrategy: BotStrategy<TapState> = {
  play: (turn) => {
    if (turn.state.phase !== "Tap") return;
    turn.once("tap", () => turn.later("react", () => turn.act("TAP")));
  },
};

/** What the bot tables need to play Tap. */
export const tapKit = (): BotKit<TapState> => ({
  roomName: TAP_ROOM,
  stateClass: TapState,
  strategy: tapStrategy,
});
