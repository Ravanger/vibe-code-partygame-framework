import type { TextFilter } from "@partygame/content/filter";
import { ErrorCode, PROTOCOL_VERSION } from "@partygame/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  type ActionLog,
  actionFactory,
  actionLogMiddleware,
  defineGame,
  getActionLog,
  getPhaseTimings,
  InvalidPrivateStateError,
  type MiddlewareContext,
  type PhaseState,
  required,
  seedFromNumber,
  textFilterMiddleware,
  timingMiddleware,
} from "../src/index.js";
import { replayLog } from "../src/replay/index.js";
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
                handler: (ctx) => ctx.transition("Score"),
              }),
              PING: action({
                from: "player",
                payload: z.object({ n: z.number() }),
                handler: (ctx) => ctx.state.log.push(`ping:${ctx.payload.n}`),
              }),
              DEEP: action({
                from: "player",
                payload: z.object({
                  data: z.object({ items: z.array(z.number()), tag: z.string() }),
                }),
                handler: (ctx) => ctx.state.log.push(`deep:${ctx.payload.data.tag}`),
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

describe("getActionLog", () => {
  it("returns undefined when no log has been recorded", () => {
    expect(getActionLog({ secret: "s" })).toBeUndefined();
  });

  it("returns undefined for a non-object priv", () => {
    expect(getActionLog(42)).toBeUndefined();
    expect(getActionLog("nope")).toBeUndefined();
    expect(getActionLog(null)).toBeUndefined();
    expect(getActionLog(undefined)).toBeUndefined();
  });

  it("returns the live log, stable across calls", () => {
    const table = new ATable();
    expect(table.log()).toBeDefined();
    expect(table.log()).toBe(table.log());
  });
});

describe("actionLogMiddleware", () => {
  it("throws InvalidPrivateStateError when its priv is not an object", () => {
    const layer = actionLogMiddleware();
    expect(() => layer(rawContext(42), () => {})).toThrow(InvalidPrivateStateError);
    expect(() => layer(rawContext(null), () => {})).toThrow(InvalidPrivateStateError);
  });

  it("writes the header on the first entry and starts with the Lobby enter", () => {
    const table = new ATable();
    const log = table.log();
    expect(log).toBeDefined();
    expect(log?.header).toEqual({
      seed: seedFromNumber(0),
      game: "Logged",
      version: "1",
      protocolVersion: PROTOCOL_VERSION,
      startedAt: 1_000_000,
    });
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

describe("action log content, ordering and isolation", () => {
  const scriptedSession = (): ATable => {
    const table = new ATable();
    table.start();
    table.act("p2", "DEEP", { data: { items: [1, 2], tag: "x" }, extra: "stripped" });
    table.joinLate("p3");
    table.tick(1000);
    return table;
  };

  it("records a scripted session exactly, in order", () => {
    const table = scriptedSession();
    expect(table.log()?.entries).toEqual([
      { seq: 1, t: 1_000_000, phase: "Lobby", kind: "enter" },
      {
        seq: 2,
        t: 1_000_000,
        phase: "Lobby",
        kind: "action",
        actionType: "START_GAME",
        senderId: "p1",
        payload: {},
      },
      { seq: 3, t: 1_000_000, phase: "Lobby", kind: "transition", from: "Lobby", to: "Play" },
      { seq: 4, t: 1_000_000, phase: "Play", kind: "enter" },
      {
        seq: 5,
        t: 1_000_000,
        phase: "Play",
        kind: "action",
        actionType: "DEEP",
        senderId: "p2",
        payload: { data: { items: [1, 2], tag: "x" } },
      },
      { seq: 6, t: 1_000_000, phase: "Play", kind: "roster-change" },
      { seq: 7, t: 1_001_000, phase: "Play", kind: "timeout" },
      { seq: 8, t: 1_001_000, phase: "Play", kind: "transition", from: "Play", to: "Score" },
      { seq: 9, t: 1_001_000, phase: "Score", kind: "enter" },
    ]);
  });

  it("captures payloads verbatim: the zod-parsed object, unknown fields stripped", () => {
    const table = scriptedSession();
    const deep = table.log()?.entries.find((e) => e.kind === "action" && e.actionType === "DEEP");
    expect(deep?.payload).toEqual({ data: { items: [1, 2], tag: "x" } });
    expect(Object.keys(deep?.payload as object)).toEqual(["data"]);
  });

  it("never touches ctx.state or priv: no framework keys land in the game's private state", () => {
    const table = scriptedSession();
    expect(Object.keys(table.state)).toEqual(["phase", "phaseEndsAt", "canStart", "log"]);
    expect(Object.keys(table.priv)).toEqual(["secret"]);
  });

  it("round-trips through JSON.stringify and JSON.parse", () => {
    const table = scriptedSession();
    const log = table.log();
    expect(log).toBeDefined();
    const roundTripped = JSON.parse(JSON.stringify(log));
    expect(roundTripped).toEqual(log);
    expect(getActionLog(table.priv)).toBe(log);
  });
});

describe("framework data stays out of the game's priv", () => {
  interface P2 {
    actionLog: string;
    phaseTimings: number;
  }

  const collisionTable = (): TestTable<S, P2, O> =>
    new TestTable({
      definition: defineGame<S, P2, O>({
        name: "Collision",
        version: "1",
        minPlayers: 1,
        maxPlayers: 4,
        startPhase: "Play",
        createPrivateState: () => ({ actionLog: "mine", phaseTimings: 1 }),
        phases: {
          Play: { duration: 1000, onTimeout: (ctx) => ctx.transition("Score") },
          Score: {},
        },
        middleware: [actionLogMiddleware(), timingMiddleware()],
      }),
      state: { phase: "", phaseEndsAt: 0, canStart: false, log: [] },
      options: { rounds: 2 },
      players: 2,
    });

  it("keeps game fields named like the old store keys untouched and adds no framework keys", () => {
    const table = collisionTable();
    table.start();
    expect(table.priv).toEqual({ actionLog: "mine", phaseTimings: 1 });
    expect(Object.keys(table.priv)).toEqual(["actionLog", "phaseTimings"]);
    expect(getActionLog(table.priv)?.entries.length).toBeGreaterThan(0);
    expect(getPhaseTimings(table.priv)?.Play).toBeDefined();
  });
});

describe("action log roster", () => {
  const defaultSeat = (id: string) => ({ id, isConnected: true, isReady: true, isActive: true });

  it("records the seats with their flags when START_GAME is dispatched, and only then", () => {
    const table = new ATable();
    expect(table.log()?.roster).toBeUndefined(); // lobby only: no start yet
    table.start();
    expect(table.log()?.roster).toEqual([defaultSeat("p1"), defaultSeat("p2")]);
  });

  it("captures the roster at start time, not later joins", () => {
    const table = new ATable();
    table.start();
    table.joinLate("p3");
    expect(table.log()?.roster).toEqual([defaultSeat("p1"), defaultSeat("p2")]);
  });

  it("records the roster once: a second start after returnToLobby does not overwrite it", () => {
    const table = new ATable();
    table.start();
    table.act("p1", "END_GAME"); // back to the Lobby
    table.joinLate("p3");
    table.start(); // second start
    const log = table.log();
    expect(log?.roster).toEqual([defaultSeat("p1"), defaultSeat("p2")]);
    expect(log?.entries.filter((e) => e.actionType === "START_GAME")).toHaveLength(2);
  });
});

const redactFilter: TextFilter = {
  check(text) {
    return text.includes("bad") ? { ok: false, reason: "no bad words" } : { ok: true };
  },
};

/** A table whose logger sits outside the text filter, so it observes the filter's rejection. */
class RTable extends TestTable<S, P, O> {
  constructor() {
    super({
      definition: defineGame<S, P, O>({
        name: "Redacted",
        version: "1",
        minPlayers: 1,
        maxPlayers: 4,
        startPhase: "Play",
        createPrivateState: () => ({ secret: "s" }),
        filterLevel: () => "moderate",
        phases: {
          Play: {
            duration: 1000,
            onTimeout: (ctx) => ctx.transition("Score"),
            actions: {
              SAY: action({
                from: "player",
                payload: z.object({ text: z.string() }),
                textFields: ["text"],
                handler: (ctx) => ctx.state.log.push(`said:${ctx.payload.text}`),
              }),
              REFUSE: action({
                from: "player",
                payload: z.object({}),
                handler: (ctx) => ctx.reject(ErrorCode.NOT_ALLOWED, "no"),
              }),
            },
          },
          Score: {},
        },
        middleware: [actionLogMiddleware(), textFilterMiddleware(redactFilter)],
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

describe("redacted rejections", () => {
  it("records a filter rejection with rejected and redacted, and no payload", () => {
    const table = new RTable();
    table.start();
    table.act("p2", "SAY", { text: "a bad one" });
    const entry = required(
      table.log()?.entries.find((e) => e.kind === "action" && e.actionType === "SAY"),
      "SAY log entry",
    );
    expect(entry.senderId).toBe("p2");
    expect(entry.rejected).toBe(true);
    expect(entry.redacted).toBe(true);
    expect(entry.payload).toBeUndefined();
    expect(JSON.stringify(table.log())).not.toContain("bad one");
  });

  it("keeps the payload of a rejection that did not ask for redaction", () => {
    const table = new RTable();
    table.start();
    table.act("p2", "REFUSE");
    const entry = required(
      table.log()?.entries.find((e) => e.kind === "action" && e.actionType === "REFUSE"),
      "REFUSE log entry",
    );
    expect(entry.rejected).toBe(true);
    expect(entry.redacted).toBeUndefined();
    expect(entry.payload).toEqual({});
  });
});

describe("payload immutability", () => {
  interface Payload {
    x: number;
    items: number[];
    data: { value: string };
  }
  let handled: Payload | undefined;

  class MutatingTable extends TestTable<S, P, O> {
    constructor() {
      super({
        definition: defineGame<S, P, O>({
          name: "Mutating",
          version: "1",
          minPlayers: 1,
          maxPlayers: 2,
          startPhase: "Play",
          createPrivateState: () => ({ secret: "s" }),
          phases: {
            Play: {
              actions: {
                MUTATE: action({
                  from: "player",
                  payload: z.object({
                    x: z.number(),
                    items: z.array(z.number()),
                    data: z.object({ value: z.string() }),
                  }),
                  handler: (ctx) => {
                    handled = ctx.payload;
                    ctx.payload.x = 99;
                    ctx.payload.items.push(999);
                    ctx.payload.data.value = "changed";
                  },
                }),
              },
            },
          },
          middleware: [actionLogMiddleware()],
        }),
        state: { phase: "", phaseEndsAt: 0, canStart: false, log: [] },
        options: { rounds: 1 },
        players: 1,
      });
    }

    logged(): Payload {
      const entry = getActionLog(this.priv)?.entries.find((e) => e.actionType === "MUTATE");
      return entry?.payload as Payload;
    }
  }

  const original = { x: 1, items: [1, 2], data: { value: "kept" } };

  it("keeps the payload as sent when the handler mutates it", () => {
    const table = new MutatingTable();
    table.start();
    table.act("p1", "MUTATE", structuredClone(original));
    expect(table.logged()).toEqual(original);
    expect(table.logged()).not.toBe(handled);
  });

  it("freezes the logged payload deeply", () => {
    const table = new MutatingTable();
    table.start();
    table.act("p1", "MUTATE", structuredClone(original));
    const logged = table.logged();
    expect(Object.isFrozen(logged)).toBe(true);
    expect(Object.isFrozen(logged.items)).toBe(true);
    expect(Object.isFrozen(logged.data)).toBe(true);
    expect(() => {
      logged.data.value = "rewritten";
    }).toThrow(TypeError);
  });
});

describe("a failed run", () => {
  const definition = defineGame<S, P, O>({
    name: "Failing",
    version: "1",
    minPlayers: 1,
    maxPlayers: 4,
    startPhase: "Play",
    createPrivateState: () => ({ secret: "s" }),
    phases: {
      Play: {
        duration: 1000,
        onTimeout: () => {
          throw new Error("timeout boom");
        },
        actions: {
          BOOM: action({
            from: "player",
            payload: z.object({}),
            handler: () => {
              throw new Error("boom");
            },
          }),
        },
      },
    },
    middleware: [actionLogMiddleware()],
  });
  const newState = (): S => ({ phase: "", phaseEndsAt: 0, canStart: false, log: [] });
  const failing = () =>
    new TestTable<S, P, O>({ definition, state: newState(), options: { rounds: 2 }, players: 2 });

  const attempt = (fn: () => void): void => {
    try {
      fn();
    } catch {
      // the run's failure is rethrown to the caller; only the log matters here
    }
  };

  it("logs a transition to the Lobby before the Lobby enter", () => {
    const table = failing();
    table.start();
    attempt(() => table.act("p2", "BOOM"));
    const kinds = (getActionLog(table.priv)?.entries ?? []).map(
      (e) => `${e.kind}:${e.to ?? e.phase}`,
    );
    expect(kinds.slice(-3)).toEqual(["action:Play", "transition:Lobby", "enter:Lobby"]);
  });

  it("is refused by replayLog with one named error", () => {
    const table = failing();
    table.start();
    attempt(() => table.act("p2", "BOOM"));
    const log = JSON.parse(JSON.stringify(getActionLog(table.priv))) as ActionLog;
    const replay = () => replayLog(definition, log, { state: newState(), options: { rounds: 2 } });
    expect(replay).toThrow(/replayLog: entry \d+ .*failed run.*boom/);
  });

  it("is refused by replayLog when the failure came from a timeout", () => {
    const table = failing();
    table.start();
    attempt(() => table.tick(1000));
    const log = JSON.parse(JSON.stringify(getActionLog(table.priv))) as ActionLog;
    const replay = () => replayLog(definition, log, { state: newState(), options: { rounds: 2 } });
    expect(replay).toThrow(/replayLog: entry \d+ .*failed run.*timeout boom/);
  });
});
