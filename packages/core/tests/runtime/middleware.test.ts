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
          JUMP: action({
            from: "player",
            payload: z.object({}),
            handler: (ctx) => ctx.transition("Hop"),
          }),
          STAY: action({
            from: "player",
            payload: z.object({}),
            handler: (ctx) => ctx.transition("Play"),
          }),
        },
      },
      Hop: {
        onEnter: (ctx) => ctx.transition("Score"),
      },
      Score: {
        actions: {
          HOME: action({
            from: "host",
            payload: z.object({}),
            handler: (ctx) => ctx.returnToLobby(),
          }),
        },
      },
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

describe("middleware transition observation", () => {
  const recordTransitions =
    (seen: string[]): PhaseMiddleware<S, P, O> =>
    (ctx, next) => {
      if (ctx.event.kind === "transition") {
        seen.push(`${ctx.event.from}->${ctx.event.to}`);
      }
      next();
    };

  it("records (from, to) for each applied transition", () => {
    const seen: string[] = [];
    const table = new MTable([recordTransitions(seen)]);
    table.start();
    expect(seen).toEqual(["Lobby->Play"]);
    table.act("p2", "GO");
    expect(seen).toEqual(["Lobby->Play", "Play->Score"]);
    table.act("p1", "HOME");
    expect(seen).toEqual(["Lobby->Play", "Play->Score", "Score->Lobby"]);
  });

  it("fires after the source enter chain has unwound", () => {
    const order: string[] = [];
    const mw: PhaseMiddleware<S, P, O> = (ctx, next) => {
      if (ctx.event.kind === "enter") {
        order.push("h-in");
        next();
        order.push("h-out");
      } else if (ctx.event.kind === "transition") {
        const e = ctx.event;
        order.push(`t:${e.from}->${e.to}`);
        next();
      } else {
        next();
      }
    };
    const table = new MTable([mw]);
    table.start();
    order.length = 0;
    table.act("p2", "JUMP");
    expect(order).toEqual(["t:Play->Hop", "h-in", "h-out", "t:Hop->Score", "h-in", "h-out"]);
  });

  it("observes a re-entry as from === to", () => {
    const seen: string[] = [];
    const table = new MTable([recordTransitions(seen)]);
    table.start();
    seen.length = 0;
    table.act("p2", "STAY");
    expect(seen).toEqual(["Play->Play"]);
  });
});

describe("middleware throws behave like hook throws", () => {
  it("surfaces an action-path throw to the caller and drops queued transitions", () => {
    // Baseline: GameRuntime.test.ts "drops queued transitions when a handler throws".
    const mw: PhaseMiddleware<S, P, O> = (ctx, next) => {
      if (ctx.event.kind === "action" && ctx.event.actionType === "GO") {
        next();
        throw new Error("mw boom");
      }
      next();
    };
    const table = new MTable([mw]);
    table.start();
    expect(() => table.act("p2", "GO")).toThrow("mw boom");
    expect(table.phase).toBe("Play");
  });

  it("surfaces an enter-path throw to the caller and keeps working", () => {
    // Baseline: GameRuntime.test.ts "surfaces an onEnter failure to the caller and keeps working".
    let explode = true;
    const mw: PhaseMiddleware<S, P, O> = (ctx, next) => {
      if (ctx.event.kind === "enter" && ctx.phase === "Play" && explode) {
        throw new Error("mw enter boom");
      }
      next();
    };
    const table = new MTable([mw]);
    expect(() => table.start()).toThrow("mw enter boom");
    explode = false;
    table.act("p2", "GO");
    expect(table.phase).toBe("Score");
  });

  it("surfaces a timeout-path throw to the timer's caller and keeps working", () => {
    // Baseline: GameRuntime.test.ts "surfaces an onTimeout failure to the timer's caller and keeps working".
    let explode = true;
    const mw: PhaseMiddleware<S, P, O> = (ctx, next) => {
      if (ctx.event.kind === "timeout" && explode) {
        throw new Error("mw timeout boom");
      }
      next();
    };
    const table = new MTable([mw]);
    table.start();
    expect(() => table.tick(1000)).toThrow("mw timeout boom");
    explode = false;
    table.act("p2", "GO");
    expect(table.phase).toBe("Score");
  });

  it("surfaces a roster-path throw to the caller and keeps working", () => {
    // No dedicated roster baseline in GameRuntime.test.ts: rosterChanged() runs inside run(),
    // so a throw propagates like the enter/timeout hook throws above.
    let explode = true;
    const mw: PhaseMiddleware<S, P, O> = (ctx, next) => {
      if (ctx.event.kind === "roster-change" && explode) {
        throw new Error("mw roster boom");
      }
      next();
    };
    const table = new MTable([mw]);
    table.start();
    expect(() => table.leave("p2")).toThrow("mw roster boom");
    explode = false;
    table.joinLate("p3");
    expect(table.state.log).toContain("roster");
  });
});

describe("middleware next() re-entrancy", () => {
  it("throws when a middleware calls next() twice for one enter event, and runs the hook once", () => {
    // Targets Play only: the initial Lobby enter happens at construction.
    const double: PhaseMiddleware<S, P, O> = (ctx, next) => {
      if (ctx.event.kind === "enter" && ctx.phase === "Play") {
        next();
        next();
      } else {
        next();
      }
    };
    const table = new MTable([double]);
    expect(() => table.start()).toThrow("middleware[0] called next() twice for one enter event");
    expect(table.state.log).toEqual(["enter:Play"]);
    // The runtime keeps working after the throw, like any hook throw.
    table.act("p2", "GO");
    expect(table.phase).toBe("Score");
  });

  it("throws when a middleware calls next() twice for one action event, and runs the handler once", () => {
    const double: PhaseMiddleware<S, P, O> = (ctx, next) => {
      if (ctx.event.kind === "action" && ctx.event.actionType === "PING") {
        next();
        next();
      } else {
        next();
      }
    };
    const table = new MTable([double]);
    table.start();
    table.state.log.length = 0;
    expect(() => table.act("p2", "PING")).toThrow(
      "middleware[0] called next() twice for one action event",
    );
    expect(table.state.log).toEqual(["ping"]);
  });
});

describe("middleware must be synchronous", () => {
  it("throws when a middleware returns a promise instead of running synchronously", () => {
    const slow: PhaseMiddleware<S, P, O> = async (_ctx, next) => {
      await Promise.resolve();
      next();
    };
    const table = new MTable([slow]);
    // The initial Lobby enter happens at construction; its failure is deferred like any hook failure.
    expect(() => table.start()).toThrow(
      "middleware[0] returned a Promise; the middleware chain is synchronous",
    );
  });

  it("ignores non-promise return values", () => {
    const tag: PhaseMiddleware<S, P, O> = (_ctx, next) => {
      next();
      return {};
    };
    const table = new MTable([tag]);
    table.start();
    expect(table.act("p2", "PING")).toBeUndefined();
    expect(table.state.log).toContain("ping");
  });
});
