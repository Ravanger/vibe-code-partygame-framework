import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  actionFactory,
  defineGame,
  type GameDefinition,
  type PhaseMiddleware,
  type PhaseState,
} from "../../src/index.js";

interface S extends PhaseState {
  total: number;
}
interface P {
  seen: string[];
}
interface O {
  limit: number;
}

const action = actionFactory<S, P, O>();

const game = defineGame<S, P, O>({
  name: "Types",
  minPlayers: 1,
  maxPlayers: 2,
  startPhase: "Play",
  createPrivateState: () => ({ seen: [] }),
  phases: {
    Play: {
      duration: (ctx) => ctx.options.limit,
      onTimeout: (ctx) => ctx.transition("Play"),
      actions: {
        ADD: action({
          from: "player",
          payload: z.object({ amount: z.number() }),
          handler: (ctx) => {
            ctx.state.total += ctx.payload.amount.valueOf();
          },
        }),
        NOTE: action({
          from: "player",
          payload: z.object({ text: z.string() }),
          handler: (ctx) => {
            ctx.priv.seen.push(ctx.payload.text.toUpperCase());
          },
        }),
        BAD: action({
          from: "player",
          payload: z.object({ amount: z.number() }),
          // @ts-expect-error the handler cannot read a field the schema does not declare
          handler: (ctx) => ctx.payload.text,
        }),
      },
    },
  },
});

// An erased middleware must be accepted where a game-typed one is expected. This guards the
// variance design: MiddlewareContext stays an interface extending GameContext (property
// covariance), so do not "improve" it into something that breaks this assignment.
const erasedMiddleware: PhaseMiddleware<PhaseState, unknown, unknown> = (ctx, next) => {
  if (ctx.event.kind === "enter") next();
};

const withMiddleware = defineGame<S, P, O>({
  name: "TypesMw",
  minPlayers: 1,
  maxPlayers: 2,
  startPhase: "Play",
  createPrivateState: () => ({ seen: [] }),
  phases: { Play: {} },
  middleware: [erasedMiddleware],
});

describe("definition types", () => {
  it("lets one phase hold actions with different payloads", () => {
    expect(Object.keys(game.phases.Play?.actions ?? {})).toEqual(["ADD", "NOTE", "BAD"]);
  });

  it("is assignable to an erased definition, as the server needs", () => {
    const erased: GameDefinition<PhaseState, unknown, unknown> = game;
    expect(erased.name).toBe("Types");
  });

  it("accepts an erased middleware where a game-typed one is expected", () => {
    expect(withMiddleware.middleware).toHaveLength(1);
  });
});
