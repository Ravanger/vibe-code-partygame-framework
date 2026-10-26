import type { FilterLevel, TextFilter } from "@partygame/content/filter";
import { ErrorCode } from "@partygame/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  actionFactory,
  defineGame,
  getPhaseTimings,
  InvalidPrivateStateError,
  loggingMiddleware,
  type MiddlewareContext,
  type PhaseMiddleware,
  type PhaseState,
  type PhaseTimingRecord,
  textFilterMiddleware,
  timingMiddleware,
} from "../src/index.js";
import { TestTable } from "../src/testing/TestTable.js";

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

class LTable extends TestTable<S, P, O> {
  constructor(lines: string[]) {
    super({
      definition: defineGame<S, P, O>({
        name: "Log",
        version: "1",
        minPlayers: 1,
        maxPlayers: 4,
        startPhase: "Play",
        createPrivateState: () => ({ secret: "s" }),
        phases: {
          Play: {
            duration: 1000,
            onTimeout: (ctx) => ctx.transition("Score"),
            actions: {
              GO: action({
                from: "player",
                payload: z.object({}),
                handler: (ctx) => ctx.state.log.push("go"),
              }),
            },
          },
          Score: {},
        },
        middleware: [loggingMiddleware({ log: (line) => lines.push(line) })],
      }),
      state: { phase: "", phaseEndsAt: 0, canStart: false, log: [] },
      options: { rounds: 2 },
      players: 2,
    });
  }
}

describe("loggingMiddleware", () => {
  it("logs lifecycle events and actions in the exact formats", () => {
    const lines: string[] = [];
    const table = new LTable(lines);
    lines.length = 0;
    table.start();
    table.act("p2", "GO");
    table.tick(1000);
    expect(lines).toEqual([
      "action START_GAME by p1 in Lobby",
      "transition Lobby -> Play",
      "enter Play",
      "action GO by p2 in Play",
      "timeout Play",
      "transition Play -> Score",
      "enter Score",
    ]);
  });

  it("emits no line for roster changes", () => {
    const lines: string[] = [];
    const table = new LTable(lines);
    lines.length = 0;
    table.start();
    const before = [...lines];
    table.joinLate("p3");
    expect(lines).toEqual(before);
  });
});

class TTable extends TestTable<S, P, O> {
  constructor(middleware: PhaseMiddleware<S, P, O>[] = [timingMiddleware()]) {
    super({
      definition: defineGame<S, P, O>({
        name: "Timed",
        version: "1",
        minPlayers: 1,
        maxPlayers: 4,
        startPhase: "Play",
        createPrivateState: () => ({ secret: "s" }),
        phases: {
          Play: {
            duration: 1000,
            onTimeout: (ctx) => ctx.transition("Score"),
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
      }),
      state: { phase: "", phaseEndsAt: 0, canStart: false, log: [] },
      options: { rounds: 2 },
      players: 2,
    });
  }
}

const timings = (table: TTable): Record<string, PhaseTimingRecord> =>
  getPhaseTimings(table.priv) ?? {};

/** A hand-built middleware context, for driving a layer with an out-of-contract priv. */
const rawContext = (priv: unknown): MiddlewareContext<PhaseState, unknown, unknown> => ({
  state: { phase: "Lobby", phaseEndsAt: 0, canStart: false },
  priv,
  options: {},
  phase: "Lobby",
  players: () => [],
  activePlayers: () => [],
  player: () => undefined,
  activateWaitingPlayers: () => {},
  send: () => {},
  broadcast: () => {},
  log: Object.assign(() => {}, { warn() {}, error() {} }),
  showTo: () => {},
  hideFrom: () => {},
  transition: () => {},
  returnToLobby: () => {},
  rng: () => 0,
  newId: () => "id",
  now: () => 0,
  gameName: "G",
  gameVersion: "1",
  seed: [0, 0, 0, 0],
  event: { kind: "enter" },
  rejectionCount: 0,
  redactedRejectionCount: 0,
  reject: () => {},
});

describe("getPhaseTimings", () => {
  it("returns undefined for a non-object priv", () => {
    expect(getPhaseTimings(42)).toBeUndefined();
    expect(getPhaseTimings("nope")).toBeUndefined();
    expect(getPhaseTimings(null)).toBeUndefined();
    expect(getPhaseTimings(undefined)).toBeUndefined();
  });

  it("returns the live store, stable across calls", () => {
    const table = new TTable();
    const first = timings(table);
    expect(first).toBeDefined();
    expect(timings(table)).toBe(first);
  });
});

describe("timingMiddleware", () => {
  it("throws InvalidPrivateStateError when its priv is not an object", () => {
    const layer = timingMiddleware();
    expect(() => layer(rawContext(42), () => {})).toThrow(InvalidPrivateStateError);
    expect(() => layer(rawContext(null), () => {})).toThrow(InvalidPrivateStateError);
  });

  it("records each phase's duration in ms, oldest first", () => {
    const table = new TTable();
    table.start();
    table.tick(1000);
    const t = timings(table);
    expect(t.Lobby?.durationsMs).toEqual([0]);
    expect(t.Play?.durationsMs).toEqual([1000]);
    expect(t.Score?.durationsMs).toEqual([]);
  });

  it("keeps previous durations and resets enteredAt on re-entry", () => {
    const table = new TTable();
    table.start();
    table.tick(1000);
    table.act("p1", "HOME");
    table.start();
    const t = timings(table);
    expect(t.Play?.durationsMs).toEqual([1000]);
    expect(t.Play?.enteredAt).toBe(1_001_000);
  });

  it("leaves the open phase without a completed duration", () => {
    const table = new TTable();
    table.start();
    const t = timings(table);
    expect(t.Play?.enteredAt).toBe(1_000_000);
    expect(t.Play?.durationsMs).toEqual([]);
  });

  it("never writes to ctx.state", () => {
    const table = new TTable();
    table.start();
    table.tick(1000);
    expect(Object.keys(table.state)).toEqual(["phase", "phaseEndsAt", "canStart", "log"]);
  });

  it("ignores a transition out of a phase whose enter was skipped", () => {
    const skipPlayEnter: PhaseMiddleware<S, P, O> = (ctx, next) => {
      if (ctx.event.kind === "enter" && ctx.phase === "Play") return;
      next();
    };
    const table = new TTable([skipPlayEnter, timingMiddleware()]);
    table.start();
    table.tick(1000);
    const t = timings(table);
    expect(t.Play).toBeUndefined();
    expect(t.Score?.durationsMs).toEqual([]);
  });
});

describe("compile-time sync rule", () => {
  it("rejects an async layer at compile time and accepts a synchronous one", () => {
    // If the chain's return type were ever widened back to `void`, the async layer below would
    // become assignable, `rejected` would resolve to `true`, and this file would stop compiling.
    const asyncLayer = async (
      _ctx: MiddlewareContext<PhaseState, unknown, unknown>,
      next: () => void,
    ) => {
      next();
    };
    type IsAssignable<F, T> = F extends T ? true : false;
    const rejected: IsAssignable<
      typeof asyncLayer,
      PhaseMiddleware<PhaseState, unknown, unknown>
    > = false;
    expect(rejected).toBe(false);
    const sync: PhaseMiddleware<PhaseState, unknown, unknown> = (_ctx, next) => {
      next();
    };
    expect(sync).toBeTypeOf("function");
  });
});

class FTable extends TestTable<S, P, O> {
  constructor(
    middleware: PhaseMiddleware<S, P, O>[],
    filterLevel?: (options: O) => FilterLevel,
    onError?: (error: unknown) => void,
  ) {
    super({
      definition: defineGame<S, P, O>({
        name: "Filter",
        version: "1",
        minPlayers: 1,
        maxPlayers: 4,
        startPhase: "Play",
        createPrivateState: () => ({ secret: "s" }),
        ...(filterLevel ? { filterLevel } : {}),
        onError: (_ctx, error) => onError?.(error),
        phases: {
          Play: {
            actions: {
              SAY: action({
                from: "player",
                payload: z.object({ text: z.string() }),
                textFields: ["text"],
                handler: (ctx) => ctx.state.log.push(`said:${ctx.payload.text}`),
              }),
              SHOUT: action({
                from: "player",
                payload: z.object({ first: z.string(), second: z.string() }),
                textFields: ["first", "second"],
                handler: (ctx) => ctx.state.log.push("shouted"),
              }),
              MUMBLE: action({
                from: "player",
                payload: z.object({ text: z.string() }),
                handler: (ctx) => ctx.state.log.push("mumbled"),
              }),
              COUNT: action({
                from: "player",
                payload: z.object({ n: z.number() }),
                textFields: ["n"],
                handler: (ctx) => ctx.state.log.push(`counted:${ctx.payload.n}`),
              }),
            },
          },
        },
        middleware,
      }),
      state: { phase: "", phaseEndsAt: 0, canStart: false, log: [] },
      options: { rounds: 2 },
      players: 2,
    });
  }
}

describe("MiddlewareContext.reject", () => {
  it("stops the chain, reaches the sender and counts as a rejection", () => {
    const seen: number[] = [];
    const observe: PhaseMiddleware<S, P, O> = (ctx, next) => {
      next();
      if (ctx.event.kind === "action" && ctx.event.actionType === "SAY")
        seen.push(ctx.rejectionCount);
    };
    const veto: PhaseMiddleware<S, P, O> = (ctx, next) => {
      if (ctx.event.kind === "action" && ctx.event.actionType === "SAY") {
        ctx.reject(ErrorCode.NOT_ALLOWED, "no saying");
        return;
      }
      next();
    };
    const table = new FTable([observe, veto]);
    table.start();
    const error = table.act("p2", "SAY", { text: "hello" });
    expect(error).toEqual({ code: ErrorCode.NOT_ALLOWED, message: "no saying", action: "SAY" });
    expect(table.errors("p2")).toContainEqual(error);
    expect(seen).toEqual([1]);
    expect(table.state.log).toEqual([]);
  });

  it("throws for non-action events, like a hook throw", () => {
    const errors: unknown[] = [];
    const vetoEnter: PhaseMiddleware<S, P, O> = (ctx, next) => {
      if (ctx.event.kind === "enter" && ctx.phase === "Play")
        ctx.reject(ErrorCode.NOT_ALLOWED, "no");
      next();
    };
    const table = new FTable([vetoEnter], undefined, (error) => errors.push(error));
    expect(() => table.start()).toThrow("only available for action events");
    expect(errors).toHaveLength(1);
    expect(table.state.notice).toBe("The game stopped because of an unexpected error.");
  });
});

const filterCalls: [FilterLevel, string][] = [];
const testFilter: TextFilter = {
  check(text, level) {
    filterCalls.push([level, text]);
    return text.includes("bad") ? { ok: false, reason: "no bad words" } : { ok: true };
  },
};

describe("textFilterMiddleware", () => {
  it("rejects a declared text field that fails the filter, without running the handler", () => {
    filterCalls.length = 0;
    const table = new FTable([textFilterMiddleware(testFilter)], () => "moderate");
    table.start();
    const error = table.act("p2", "SAY", { text: "a bad one" });
    expect(error).toEqual({
      code: ErrorCode.CONTENT_REJECTED,
      message: "no bad words",
      action: "SAY",
    });
    expect(table.errors("p2")).toContainEqual(error);
    expect(table.state.log).toEqual([]);
    expect(filterCalls).toEqual([["moderate", "a bad one"]]);
  });

  it("lets clean text reach the handler", () => {
    const table = new FTable([textFilterMiddleware(testFilter)], () => "moderate");
    table.start();
    expect(table.act("p2", "SAY", { text: "fine" })).toBeUndefined();
    expect(table.state.log).toEqual(["said:fine"]);
  });

  it("checks every declared field in order and rejects on the first failure", () => {
    filterCalls.length = 0;
    const table = new FTable([textFilterMiddleware(testFilter)], () => "strict");
    table.start();
    expect(table.act("p2", "SHOUT", { first: "clean", second: "bad" })).toEqual({
      code: ErrorCode.CONTENT_REJECTED,
      message: "no bad words",
      action: "SHOUT",
    });
    expect(table.state.log).toEqual([]);
    expect(filterCalls).toEqual([
      ["strict", "clean"],
      ["strict", "bad"],
    ]);
  });

  it("never calls the filter when the level is off, including by default", () => {
    filterCalls.length = 0;
    const table = new FTable([textFilterMiddleware(testFilter)]); // no filterLevel: defaults to off
    table.start();
    expect(table.act("p2", "SAY", { text: "a bad one" })).toBeUndefined();
    expect(table.state.log).toEqual(["said:a bad one"]);
    expect(filterCalls).toEqual([]);
  });

  it("leaves an action without textFields untouched", () => {
    filterCalls.length = 0;
    const table = new FTable([textFilterMiddleware(testFilter)], () => "strict");
    table.start();
    expect(table.act("p2", "MUMBLE", { text: "a bad one" })).toBeUndefined();
    expect(table.state.log).toEqual(["mumbled"]);
    expect(filterCalls).toEqual([]);
  });

  it("skips a declared field that is not a string", () => {
    filterCalls.length = 0;
    const table = new FTable([textFilterMiddleware(testFilter)], () => "strict");
    table.start();
    expect(table.act("p2", "COUNT", { n: 3 })).toBeUndefined();
    expect(table.state.log).toEqual(["counted:3"]);
    expect(filterCalls).toEqual([]);
  });

  it("calls onRejected once with the filter's reason when it refuses an action", () => {
    const reasons: string[] = [];
    const table = new FTable(
      [textFilterMiddleware(testFilter, { onRejected: (_ctx, reason) => reasons.push(reason) })],
      () => "moderate",
    );
    table.start();
    const error = table.act("p2", "SAY", { text: "a bad one" });
    expect(error?.code).toBe(ErrorCode.CONTENT_REJECTED);
    expect(table.state.log).toEqual([]);
    expect(reasons).toEqual(["no bad words"]);
  });

  it("rejects with redactPayload, visible to an outer middleware after next()", () => {
    const counts: number[] = [];
    const observe: PhaseMiddleware<S, P, O> = (ctx, next) => {
      next();
      if (ctx.event.kind === "action" && ctx.event.actionType === "SAY")
        counts.push(ctx.redactedRejectionCount);
    };
    const table = new FTable([observe, textFilterMiddleware(testFilter, {})], () => "moderate");
    table.start();
    table.act("p2", "SAY", { text: "a bad one" });
    expect(counts).toEqual([1]);
  });
});
