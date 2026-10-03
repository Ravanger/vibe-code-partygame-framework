import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  actionFactory,
  defineGame,
  loggingMiddleware,
  PHASE_TIMINGS,
  type PhaseMiddleware,
  type PhaseState,
  type PhaseTimingRecord,
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
  (table.priv as { [PHASE_TIMINGS]?: Record<string, PhaseTimingRecord> })[PHASE_TIMINGS] ?? {};

describe("timingMiddleware", () => {
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
