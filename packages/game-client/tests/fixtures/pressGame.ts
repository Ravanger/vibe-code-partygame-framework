import { type SchemaType, t } from "@colyseus/schema";
import { actionFactory, defineGame } from "@partygame/core";
import { BaseGameState } from "@partygame/shared/schema";
import { z } from "zod";

export const PressState = BaseGameState.extend({ presses: t.number().default(0) }, "PressState");
export type PressState = SchemaType<typeof PressState>;

export const ROOM = "press";
const MAX_PRESSES = 3;

const action = actionFactory<PressState, Record<string, never>, Record<string, never>>();

export const PressGame = defineGame<PressState, Record<string, never>, Record<string, never>>({
  name: "Press",
  minPlayers: 2,
  autoStart: true,
  maxPlayers: 3,
  startPhase: "Play",
  createPrivateState: () => ({}),
  phases: {
    Play: {
      actions: {
        PRESS: action({
          from: "player",
          payload: z.object({ times: z.number().int().min(1).default(1) }),
          handler: (ctx) => {
            if (ctx.state.presses >= MAX_PRESSES) {
              ctx.reject("NOT_ALLOWED", "The button is worn out");
              return;
            }
            ctx.state.presses += ctx.payload.times;
          },
        }),
      },
    },
  },
});

export const GAMES = [{ roomName: ROOM, definition: PressGame, stateClass: PressState }];
