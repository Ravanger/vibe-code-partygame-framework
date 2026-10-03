import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ACTION_LOG,
  type ActionLog,
  actionFactory,
  actionLogMiddleware,
  defineGame,
  getActionLog,
  type PhaseState,
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

class ATable extends TestTable<S, P, O> {
  constructor() {
    super({
      definition: defineGame<S, P, O>({
        name: "Logged",
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
                handler: (ctx) => ctx.transition("Score"),
              }),
              PING: action({
                from: "player",
                payload: z.object({ n: z.number() }),
                handler: (ctx) => ctx.state.log.push(`ping:${ctx.payload.n}`),
              }),
            },
          },
          Score: {},
        },
        middleware: [actionLogMiddleware()],
      }),
      state: { phase: "", phaseEndsAt: 0, canStart: false, log: [] },
      options: { rounds: 2 },
      players: 2,
    });
  }

  log(): ActionLog | undefined {
    return getActionLog(this.priv);
  }
}

describe("getActionLog", () => {
  it("returns undefined when no log has been recorded", () => {
    expect(getActionLog({ secret: "s" })).toBeUndefined();
  });

  it("returns the stored log under the ACTION_LOG key, stable across calls", () => {
    const priv: Record<string, unknown> = { secret: "s" };
    const log = { header: { seed: 1, game: "G", startedAt: 0 }, entries: [] as unknown[] };
    priv[ACTION_LOG] = log;
    expect(getActionLog(priv)).toBe(log);
    expect(getActionLog(priv)).toBe(log);
  });
});

describe("actionLogMiddleware", () => {
  it("writes the header on the first entry and starts with the Lobby enter", () => {
    const table = new ATable();
    const log = table.log();
    expect(log).toBeDefined();
    expect(log?.header).toEqual({ seed: 0, game: "Logged", startedAt: 1_000_000 });
    expect(log?.entries[0]).toEqual({ seq: 1, t: 1_000_000, phase: "Lobby", kind: "enter" });
  });

  it("records every middleware-visible event with strictly increasing seq from 1", () => {
    const table = new ATable();
    table.start();
    table.act("p2", "PING", { n: 7 });
    table.joinLate("p3");
    table.tick(1000);
    const log = table.log();
    expect(log?.entries.map((e) => e.kind)).toEqual([
      "enter", // Lobby, at construction
      "action", // START_GAME
      "transition", // Lobby -> Play
      "enter", // Play
      "action", // PING
      "roster-change", // joinLate in Play
      "timeout", // Play
      "transition", // Play -> Score
      "enter", // Score
    ]);
    expect(log?.entries.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("takes t from ctx.now() and phase from the current phase", () => {
    const table = new ATable();
    table.start();
    table.act("p2", "PING", { n: 7 });
    table.tick(1000);
    const log = table.log();
    expect(log?.entries[4]).toEqual({
      seq: 5,
      t: 1_000_000,
      phase: "Play",
      kind: "action",
      actionType: "PING",
      senderId: "p2",
      payload: { n: 7 },
    });
    expect(log?.entries[5]).toEqual({ seq: 6, t: 1_001_000, phase: "Play", kind: "timeout" });
  });

  it("records from/to on transition entries and nothing extra on other kinds", () => {
    const table = new ATable();
    table.start();
    const log = table.log();
    expect(log?.entries[2]).toEqual({
      seq: 3,
      t: 1_000_000,
      phase: "Lobby",
      kind: "transition",
      from: "Lobby",
      to: "Play",
    });
    for (const entry of log?.entries ?? []) {
      if (entry.kind === "enter" || entry.kind === "timeout" || entry.kind === "roster-change") {
        expect(Object.keys(entry).sort()).toEqual(["kind", "phase", "seq", "t"]);
      }
    }
  });
});
