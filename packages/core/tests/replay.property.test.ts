import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  type ActionLog,
  actionFactory,
  actionLogMiddleware,
  defineGame,
  getActionLog,
  type PhaseState,
} from "../src/index.js";
import { replayLog, TestTable } from "../src/testing/index.js";

interface S extends PhaseState {
  taps: number;
  rolls: number[];
}

const action = actionFactory<S, Record<string, never>, Record<string, never>>();

const definition = defineGame<S, Record<string, never>, Record<string, never>>({
  name: "PropertyReplay",
  minPlayers: 2,
  maxPlayers: 4,
  startPhase: "Tap",
  createPrivateState: () => ({}),
  phases: {
    Tap: {
      duration: 1000,
      onTimeout: (ctx) => ctx.transition("Roll"),
      actions: {
        TAP: action({
          from: "player",
          payload: z.object({ by: z.number() }),
          handler: (ctx) => {
            ctx.state.taps += ctx.payload.by;
          },
        }),
      },
    },
    Roll: {
      duration: 500,
      onEnter: (ctx) => {
        ctx.state.rolls.push(Math.floor(ctx.rng() * 1000));
      },
      onTimeout: (ctx) => ctx.transition("Tap"),
      actions: {
        TAP: action({
          from: "player",
          payload: z.object({ by: z.number() }),
          handler: (ctx) => {
            ctx.state.taps -= ctx.payload.by;
          },
        }),
      },
    },
  },
});

const newState = (): S => ({ phase: "", phaseEndsAt: 0, canStart: false, taps: 0, rolls: [] });

const step = fc.oneof(
  fc.record({
    kind: fc.constant("tap" as const),
    seat: fc.constantFrom("p1", "p2"),
    by: fc.integer({ min: -5, max: 5 }),
  }),
  fc.record({ kind: fc.constant("tick" as const), ms: fc.integer({ min: 0, max: 1500 }) }),
);

describe("replayLog properties", () => {
  it("reproduces the final state of a random session", () => {
    fc.assert(
      fc.property(fc.array(step, { maxLength: 25 }), fc.integer(), (steps, seed) => {
        const live = new TestTable({
          definition: { ...definition, middleware: [actionLogMiddleware()] },
          state: newState(),
          options: {},
          players: 2,
          seed,
        });
        live.start();
        for (const s of steps) {
          if (s.kind === "tap") live.act(s.seat, "TAP", { by: s.by });
          else live.tick(s.ms);
        }
        const log = getActionLog(live.priv) as ActionLog;
        const { states } = replayLog(definition, log, {
          state: newState(),
          options: {},
          players: 2,
        });
        expect(states.at(-1)).toEqual(live.state);
      }),
      { numRuns: 100 },
    );
  });
});
