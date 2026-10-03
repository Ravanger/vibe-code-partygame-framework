import { ErrorCode } from "@partygame/shared";
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
        onRosterChange: (ctx) => ctx.state.log.push("roster"),
        actions: {
          GO: action({
            from: "player",
            payload: z.object({}),
            handler: (ctx) => ctx.transition("Score"),
          }),
          PING: action({
            from: "player",
            payload: z.object({}),
            handler: (ctx) => ctx.state.log.push("ping"),
          }),
          NOPE: action({
            from: "player",
            payload: z.object({}),
            handler: (ctx) => ctx.reject(ErrorCode.NOT_ALLOWED, "nope"),
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
    if (ctx.event.kind !== "enter") {
      next();
      return;
    }
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
    // Skips only enter events so the START_GAME action can still flow.
    const skip: PhaseMiddleware<S, P, O> = (ctx, next) => {
      if (ctx.event.kind !== "enter") next();
    };
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

describe("middleware chain around action handlers", () => {
  const recordActions =
    (seen: string[]): PhaseMiddleware<S, P, O> =>
    (ctx, next) => {
      if (ctx.event.kind === "action") {
        seen.push(`${ctx.event.actionType} by ${ctx.event.senderId}`);
      }
      next();
    };

  it("sees the action type and sender for a player action", () => {
    const seen: string[] = [];
    const table = new MTable([recordActions(seen)]);
    table.start();
    seen.length = 0;
    table.act("p2", "GO");
    expect(seen).toEqual(["GO by p2"]);
  });

  it("wraps built-in actions too", () => {
    const seen: string[] = [];
    const table = new MTable([recordActions(seen)]);
    table.start();
    expect(seen).toEqual(["START_GAME by p1"]);
  });

  it("runs around the handler", () => {
    const mw: PhaseMiddleware<S, P, O> = (ctx, next) => {
      ctx.state.log.push("mw-before");
      next();
      ctx.state.log.push("mw-after");
    };
    const table = new MTable([mw]);
    table.start();
    table.state.log.length = 0;
    table.act("p2", "PING");
    expect(table.state.log).toEqual(["mw-before", "ping", "mw-after"]);
  });

  it("keeps handler rejections identical with middleware registered", () => {
    const plain = new MTable();
    plain.start();
    plain.act("p2", "NOPE");
    const wrapped = new MTable([layer("x")]);
    wrapped.start();
    wrapped.act("p2", "NOPE");
    expect(wrapped.errors("p2")).toEqual(plain.errors("p2"));
  });
});

describe("middleware chain around onTimeout and onRosterChange", () => {
  const record =
    (kind: string, seen: string[]): PhaseMiddleware<S, P, O> =>
    (ctx, next) => {
      if (ctx.event.kind === kind) {
        seen.push(`${ctx.event.kind}:${ctx.phase}`);
      }
      next();
    };

  it("wraps onTimeout and fires it exactly once", () => {
    const seen: string[] = [];
    const table = new MTable([record("timeout", seen)]);
    table.start();
    table.tick(1000);
    expect(seen).toEqual(["timeout:Play"]);
    table.tick(5000);
    expect(seen).toEqual(["timeout:Play"]);
  });

  it("does not fire onTimeout after the phase has been left", () => {
    const seen: string[] = [];
    const table = new MTable([record("timeout", seen)]);
    table.start();
    table.act("p2", "GO");
    expect(table.phase).toBe("Score");
    table.tick(10_000);
    expect(seen).toEqual([]);
  });

  it("wraps onRosterChange for joinLate, leave and drop", () => {
    const seen: string[] = [];
    const table = new MTable([record("roster-change", seen)]);
    table.start();
    table.state.log.length = 0;
    table.joinLate("p3");
    expect(seen).toEqual(["roster-change:Play"]);
    expect(table.state.log).toContain("roster");
    seen.length = 0;
    table.state.log.length = 0;
    table.leave("p3");
    expect(seen).toEqual(["roster-change:Play"]);
    expect(table.state.log).toContain("roster");
    seen.length = 0;
    table.state.log.length = 0;
    table.drop("p2");
    expect(seen).toEqual(["roster-change:Play"]);
    expect(table.state.log).toContain("roster");
  });
});
