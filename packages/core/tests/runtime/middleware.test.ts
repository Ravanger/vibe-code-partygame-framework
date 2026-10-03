import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  actionFactory,
  defineGame,
  type PhaseMiddleware,
  type PhaseState,
} from "../../src/index.js";
import { TestTable } from "../../src/testing/TestTable.js";

interface S extends PhaseState {
  log: string[];
}
interface P {
  secret: string;
}
interface O {
  rounds: number;
}

const action = actionFactory<S, P, O>();

const game = (middleware: PhaseMiddleware<S, P, O>[]) =>
  defineGame<S, P, O>({
    name: "Mw",
    minPlayers: 1,
    maxPlayers: 4,
    startPhase: "Play",
    createPrivateState: () => ({ secret: "s" }),
    phases: {
      Play: {
        duration: 1000,
        onEnter: (ctx) => ctx.state.log.push("enter:Play"),
        onTimeout: (ctx) => ctx.transition("Score"),
        actions: {
          GO: action({
            from: "player",
            payload: z.object({}),
            handler: (ctx) => ctx.transition("Score"),
          }),
        },
      },
      Score: {},
    },
    middleware,
  });

class MTable extends TestTable<S, P, O> {
  constructor(middleware: PhaseMiddleware<S, P, O>[] = []) {
    super({
      definition: game(middleware),
      state: { phase: "", phaseEndsAt: 0, canStart: false, log: [] },
      options: { rounds: 2 },
      players: 2,
    });
  }
}

const layer =
  (name: string): PhaseMiddleware<S, P, O> =>
  (ctx, next) => {
    ctx.state.log.push(`${name}-in`);
    next();
    ctx.state.log.push(`${name}-out`);
  };

describe("middleware chain around onEnter", () => {
  it("runs middlewares outermost-first around the hook", () => {
    const table = new MTable([layer("a"), layer("b"), layer("c")]);
    table.state.log.length = 0;
    table.start();
    expect(table.state.log).toEqual([
      "a-in",
      "b-in",
      "c-in",
      "enter:Play",
      "c-out",
      "b-out",
      "a-out",
    ]);
  });

  it("skips the hook when a middleware omits next(), but still enters the phase", () => {
    const skip: PhaseMiddleware<S, P, O> = () => {};
    const table = new MTable([skip]);
    table.state.log.length = 0;
    table.start();
    expect(table.phase).toBe("Play");
    expect(table.state.phaseEndsAt).toBeGreaterThan(0);
    expect(table.state.log).toEqual([]);
  });

  it("gives middleware the game context plus the event", () => {
    const seen: string[] = [];
    const mw: PhaseMiddleware<S, P, O> = (ctx, next) => {
      if (ctx.event.kind === "enter") {
        seen.push(`${ctx.phase}|${ctx.priv.secret}|${ctx.options.rounds}`);
      }
      next();
    };
    const table = new MTable([mw]);
    table.start();
    expect(seen).toEqual(["Lobby|s|2", "Play|s|2"]);
  });
});
