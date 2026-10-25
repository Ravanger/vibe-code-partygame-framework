import { type SchemaType, t } from "@colyseus/schema";
import { actionFactory, defineGame } from "@partygame/core";
import { ErrorCode } from "@partygame/shared";
import { BaseGameState } from "@partygame/shared/schema";
import { z } from "zod";

export const PollState = BaseGameState.extend(
  {
    taps: t.number().default(0),
    votesA: t.number().default(0),
    votesB: t.number().default(0),
  },
  "PollState",
);
export type PollState = SchemaType<typeof PollState>;

const action = actionFactory<PollState, Record<string, never>, Record<string, unknown>>();

/** A single-seat game that starts directly in `Play`: the audience votes, the seat tallies. */
export const PollGame = defineGame<PollState, Record<string, never>, Record<string, unknown>>({
  name: "Poll",
  version: "1",
  minPlayers: 1,
  maxPlayers: 1,
  startPhase: "Play",
  autoStart: true,
  createPrivateState: () => ({}),
  phases: {
    Play: {
      onRosterChange: (ctx) => ctx.activateWaitingPlayers(),
      actions: {
        VOTE: action({
          from: "audience",
          payload: z.object({ option: z.enum(["a", "b"]) }),
          handler: (ctx) => {
            if (!ctx.audience.once(`vote:${ctx.payload.option}`)) {
              return ctx.reject(ErrorCode.NOT_ALLOWED, "already voted");
            }
            if (ctx.payload.option === "a") ++ctx.state.votesA;
            else ++ctx.state.votesB;
          },
        }),
        TAP: action({
          from: "player",
          payload: z.object({}),
          handler: (ctx) => {
            ++ctx.state.taps;
          },
        }),
        BOOM: action({
          from: "audience",
          payload: z.object({}),
          handler: () => {
            throw new Error("boom");
          },
        }),
        TALLY: action({
          from: "player",
          payload: z.object({}),
          handler: (ctx) => ctx.transition("Tally"),
        }),
      },
    },
    Tally: {
      onRosterChange: (ctx) => ctx.activateWaitingPlayers(),
      actions: {
        REOPEN: action({
          from: "player",
          payload: z.object({}),
          handler: (ctx) => ctx.transition("Play"),
        }),
      },
    },
  },
});
