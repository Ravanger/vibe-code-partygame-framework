import { ErrorCode } from "@partygame/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ACTION_LOG,
  type ActionLog,
  actionFactory,
  actionLogMiddleware,
  defineGame,
  getActionLog,
  type PhaseMiddleware,
  type PhaseState,
  replayLog,
  required,
} from "../src/index.js";
import { FakeHost } from "../src/testing/FakeHost.js";
import { TestTable } from "../src/testing/TestTable.js";

/**
 * Adversarial QA probes R.1–R.13 for the action log + replay feature. Each probe is a test (or
 * group of tests) named after its brief item; see `.AGENTS/qa/action-log-replay.md` for verdicts.
 */

interface S extends PhaseState {
  pings: number[];
  deep: string;
}
interface P {
  secret: string;
}
interface O {
  rounds: number;
}

const action = actionFactory<S, P, O>();

/** The probe fixture game: a timed Play phase with custom + built-in actions, and an un-timed Score. */
const fullDefinition = defineGame<S, P, O>({
  name: "QAFull",
  minPlayers: 1,
  maxPlayers: 4,
  startPhase: "Play",
  createPrivateState: () => ({ secret: "s" }),
  phases: {
    Play: {
      duration: 1000,
      onTimeout: (ctx) => ctx.transition("Score"),
      actions: {
        PING: action({
          from: "player",
          payload: z.object({ n: z.number() }),
          handler: (ctx) => {
            ctx.state.pings.push(ctx.payload.n);
          },
        }),
        DEEP: action({
          from: "player",
          payload: z.object({
            data: z.object({
              items: z.array(z.number()),
              tag: z.string(),
              nested: z.object({ flag: z.boolean() }),
            }),
            count: z.number(),
          }),
          handler: (ctx) => {
            ctx.state.deep = ctx.payload.data.tag;
          },
        }),
        REJECT_ME: action({
          from: "player",
          payload: z.object({}),
          handler: (ctx) => {
            ctx.reject(ErrorCode.NOT_ALLOWED, "nope");
          },
        }),
      },
    },
    Score: {},
  },
});

const newState = (): S => ({ phase: "", phaseEndsAt: 0, canStart: false, pings: [], deep: "" });

class FTable extends TestTable<S, P, O> {
  constructor(middleware: PhaseMiddleware<S, P, O>[] = [actionLogMiddleware()]) {
    super({
      definition: { ...fullDefinition, middleware },
      state: newState(),
      options: { rounds: 2 },
      players: 2,
    });
  }

  log(): ActionLog | undefined {
    return getActionLog(this.priv);
  }
}

describe("QA probe R.1 — log completeness", () => {
  it("records every event kind of a full session, in exact order, seq strictly increasing from 1", () => {
    const table = new FTable();
    table.start(); // built-in lobby action
    table.act("p2", "PING", { n: 7 }); // custom action
    table.joinLate("p3"); // roster change
    table.tick(1000); // timeout + transition + enter
    const log = table.log();
    expect(log?.entries).toEqual([
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
        actionType: "PING",
        senderId: "p2",
        payload: { n: 7 },
      },
      { seq: 6, t: 1_000_000, phase: "Play", kind: "roster-change" },
      { seq: 7, t: 1_001_000, phase: "Play", kind: "timeout" },
      { seq: 8, t: 1_001_000, phase: "Play", kind: "transition", from: "Play", to: "Score" },
      { seq: 9, t: 1_001_000, phase: "Score", kind: "enter" },
    ]);
    expect(log?.entries.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]); // no gaps
    expect(new Set(log?.entries.map((e) => e.kind))).toEqual(
      new Set(["action", "transition", "enter", "timeout", "roster-change"]),
    );
  });
});

describe("QA probe R.2 — payload fidelity", () => {
  it("captures a nested unicode payload verbatim and the whole log JSON round-trips", () => {
    const table = new FTable();
    table.start();
    const input = {
      data: { items: [1, -2.5, 3], tag: "héllo wörld 🎉 naïve", nested: { flag: true } },
      count: 42,
    };
    table.act("p2", "DEEP", input);
    const log = table.log();
    const deep = log?.entries.find((e) => e.kind === "action" && e.actionType === "DEEP");
    expect(deep?.payload).toEqual(input);
    expect(JSON.parse(JSON.stringify(log))).toEqual(log); // lossless round-trip
  });
});

describe("QA probe R.3 — state isolation", () => {
  it("never writes to ctx.state: the state keeps exactly the game's own keys", () => {
    const table = new FTable();
    table.start();
    table.act("p2", "PING", { n: 7 });
    table.joinLate("p3");
    table.tick(1000);
    expect(Object.keys(table.state).sort()).toEqual([
      "canStart",
      "deep",
      "phase",
      "phaseEndsAt",
      "pings",
    ]);
    expect(Object.keys(table.priv).sort()).toEqual([ACTION_LOG, "secret"]);
  });
});

describe("QA probe R.4 — rejection exclusion", () => {
  it("logs none of malformed, invalid-payload, unknown, unauthorized or wrong-phase actions", () => {
    const table = new FTable();
    table.start();
    const count = (): number => table.log()?.entries.length ?? -1;
    const before = count();

    expect(table.runtime.dispatch("p2", 42)).toEqual({
      code: ErrorCode.INVALID_ACTION,
      message: "Malformed action",
    }); // malformed envelope
    expect(table.act("p2", "PING", { n: "not a number" })).toMatchObject({
      code: ErrorCode.INVALID_ACTION,
    }); // invalid payload
    expect(table.act("p2", "NOPE")).toMatchObject({ code: ErrorCode.UNKNOWN_ACTION }); // unknown action
    expect(table.act("p2", "END_GAME")).toMatchObject({ code: ErrorCode.UNAUTHORIZED }); // host-only, from a player

    table.tick(1000); // Play -> Score (timeout + transition + enter: three legitimate entries)
    const afterTick = count();
    expect(afterTick).toBe(before + 3);
    expect(table.act("p2", "PING", { n: 8 })).toMatchObject({ code: ErrorCode.WRONG_PHASE }); // declared elsewhere

    expect(count()).toBe(afterTick); // nothing rejected reached the log
    expect(table.errors("p2")).toHaveLength(5); // sanity: all five were really rejected
  });

  it("logs an action whose handler calls ctx.reject() — it reached the chain (re-dispatch re-runs the rejection)", () => {
    const table = new FTable();
    table.start();
    const before = table.log()?.entries.length ?? -1;
    expect(table.act("p2", "REJECT_ME")).toMatchObject({ code: ErrorCode.NOT_ALLOWED });
    const log = table.log();
    expect(log?.entries).toHaveLength(before + 1);
    expect(log?.entries.at(-1)).toMatchObject({
      kind: "action",
      actionType: "REJECT_ME",
      senderId: "p2",
    });
    // The re-dispatch re-runs the handler's rejection, so replayLog throws on such a log (v1 limitation).
    expect(() =>
      replayLog(fullDefinition, log as ActionLog, {
        state: newState(),
        options: { rounds: 2 },
        players: 2,
      }),
    ).toThrow(/re-dispatched action REJECT_ME was rejected/);
  });
});

describe("QA probe R.5 — RNG determinism", () => {
  it("same seed gives identical rng() sequences across two hosts; different seeds differ", () => {
    const a = new FakeHost(42);
    const b = new FakeHost(42);
    const c = new FakeHost(43);
    const seqA = Array.from({ length: 16 }, () => a.rng());
    expect(Array.from({ length: 16 }, () => b.rng())).toEqual(seqA);
    expect(Array.from({ length: 16 }, () => c.rng())).not.toEqual(seqA);
  });

  it("an unseeded FakeHost keeps its documented constant 0.5 (not replayable by seed)", () => {
    const host = new FakeHost();
    expect(host.rng()).toBe(0.5);
    expect(host.rng()).toBe(0.5);
  });

  it("ctx.rng() in a real table is drawn from the room seed: same seed, identical state", () => {
    const rollGame = defineGame<
      PhaseState & { roll: number },
      Record<string, never>,
      Record<string, never>
    >({
      name: "QARoll",
      minPlayers: 1,
      maxPlayers: 2,
      startPhase: "Roll",
      createPrivateState: () => ({}),
      phases: {
        Roll: {
          onEnter: (ctx) => {
            ctx.state.roll = Math.floor(ctx.rng() * 100);
          },
        },
      },
    });
    const fresh = () =>
      ({ phase: "", phaseEndsAt: 0, canStart: false, roll: 0 }) as PhaseState & { roll: number };
    const tableA = new TestTable({
      definition: rollGame,
      state: fresh(),
      options: {},
      players: 1,
      seed: 7,
    });
    const tableB = new TestTable({
      definition: rollGame,
      state: fresh(),
      options: {},
      players: 1,
      seed: 7,
    });
    const tableC = new TestTable({
      definition: rollGame,
      state: fresh(),
      options: {},
      players: 1,
      seed: 8,
    });
    tableA.start();
    tableB.start();
    tableC.start();
    expect(tableB.state.roll).toBe(tableA.state.roll); // same seed → same draw
    expect(tableC.state.roll).not.toBe(tableA.state.roll); // different seed → different draw
  });
});

describe("QA probe R.6 — header correctness", () => {
  it("header.seed is the room seed, header.game the definition name, startedAt the first entry's clock base", () => {
    const table = new TestTable({
      definition: { ...fullDefinition, middleware: [actionLogMiddleware()] },
      state: newState(),
      options: { rounds: 2 },
      players: 2,
      seed: 987,
    });
    const log = getActionLog(table.priv);
    expect(log?.header.seed).toBe(987);
    expect(log?.header.game).toBe("QAFull");
    expect(log?.header.startedAt).toBe(log?.entries[0]?.t);
  });

  it("getActionLog is undefined without the middleware and a stable reference with it", () => {
    const plain = new TestTable({
      definition: fullDefinition,
      state: newState(),
      options: { rounds: 2 },
      players: 2,
    });
    expect(getActionLog(plain.priv)).toBeUndefined();
    const table = new FTable();
    const log = getActionLog(table.priv);
    expect(log).toBeDefined();
    expect(getActionLog(table.priv)).toBe(log);
  });
});

describe("QA probe R.7 — adversarial replay round-trip", () => {
  // (a) an action handler that draws the RNG twice, (b) two timeouts in a row, (c) a re-entry
  // (from === to), (d) returnToLobby mid-game then start() again.
  interface RideState extends PhaseState {
    roll: number;
    d1: number;
    d2: number;
    laps: number;
  }

  const rideAction = actionFactory<RideState, Record<string, never>, Record<string, never>>();

  const rideDefinition = defineGame<RideState, Record<string, never>, Record<string, never>>({
    name: "QARide",
    minPlayers: 1,
    maxPlayers: 4,
    startPhase: "Work",
    createPrivateState: () => ({}),
    phases: {
      Work: {
        duration: 1000,
        onEnter: (ctx) => {
          ctx.state.roll = Math.floor(ctx.rng() * 100);
        },
        onTimeout: (ctx) => ctx.transition("Cool"),
        actions: {
          DO: rideAction({
            from: "player",
            payload: z.object({}),
            handler: (ctx) => {
              ctx.state.d1 = Math.floor(ctx.rng() * 10); // two draws inside one action handler
              ctx.state.d2 = Math.floor(ctx.rng() * 10);
              ctx.state.laps += 1;
            },
          }),
          REENTER: rideAction({
            from: "host",
            payload: z.object({}),
            handler: (ctx) => ctx.transition("Work"),
          }),
        },
      },
      Cool: {
        duration: 500,
        onTimeout: (ctx) => ctx.transition("End"),
      },
      End: {},
    },
  });

  const newRideState = (): RideState => ({
    phase: "",
    phaseEndsAt: 0,
    canStart: false,
    roll: 0,
    d1: 0,
    d2: 0,
    laps: 0,
  });

  it("replays rng-drawing actions, double timeouts, re-entry and a mid-game restart to identical states", () => {
    const live = new TestTable({
      definition: { ...rideDefinition, middleware: [actionLogMiddleware()] },
      state: newRideState(),
      options: {},
      players: 2,
      seed: 1234,
    });
    const snapshots: RideState[] = [];
    const snapshot = (): void => {
      snapshots.push(JSON.parse(JSON.stringify(live.state)) as RideState);
    };

    snapshot(); // Lobby at construction
    live.start(); // enter Work (draw 1)
    snapshot();
    live.act("p2", "DO"); // draws 2,3
    snapshot();
    live.act("p1", "REENTER"); // re-enter Work (draw 4)
    snapshot();
    live.tick(1000); // Work timeout -> Cool (timeout #1)
    snapshot();
    live.act("p1", "END_GAME"); // return to the Lobby mid-game
    snapshot();
    live.start(); // second game: enter Work (draw 5)
    snapshot();
    live.act("p2", "DO"); // draws 6,7
    snapshot();
    live.tick(1000); // Work timeout -> Cool (timeout #2a)
    snapshot();
    live.tick(500); // Cool timeout -> End (timeout #2b — two in a row)
    snapshot();

    const log = getActionLog(live.priv) as ActionLog;
    // sanity: the log really contains the tricky shapes
    expect(
      log.entries.some((e) => e.kind === "transition" && e.from === "Work" && e.to === "Work"),
    ).toBe(true);
    expect(log.entries.filter((e) => e.kind === "enter" && e.phase === "Lobby")).toHaveLength(2);

    const { states } = replayLog(rideDefinition, log, {
      state: newRideState(),
      options: {},
      players: 2,
    });
    expect(states).toEqual(snapshots);
  });
});

describe("QA probe R.7 extension — RNG parity for function durations", () => {
  // A legal game shape: the phase duration itself is drawn from the room RNG. Live, the duration
  // function runs at enter (a draw in the stream) BEFORE onEnter; replay must keep the same order.
  interface DurState extends PhaseState {
    roll: number;
    roll2: number;
  }

  const durDefinition = defineGame<DurState, Record<string, never>, Record<string, never>>({
    name: "QADur",
    minPlayers: 1,
    maxPlayers: 2,
    startPhase: "Wait",
    createPrivateState: () => ({}),
    phases: {
      Wait: {
        duration: (ctx) => 1000 + Math.floor(ctx.rng() * 500),
        onEnter: (ctx) => {
          ctx.state.roll = Math.floor(ctx.rng() * 100);
          ctx.state.roll2 = Math.floor(ctx.rng() * 100);
        },
        onTimeout: (ctx) => ctx.transition("Done"),
      },
      Done: {},
    },
  });

  const freshDur = (): DurState => ({
    phase: "",
    phaseEndsAt: 0,
    canStart: false,
    roll: 0,
    roll2: 0,
  });

  it("a function duration that draws the RNG keeps replay in step with the live draw stream", () => {
    const live = new TestTable({
      definition: { ...durDefinition, middleware: [actionLogMiddleware()] },
      state: freshDur(),
      options: {},
      players: 1,
      seed: 55,
    });
    live.start();
    live.tick(2000); // covers the maximum possible duration (1499)
    const log = getActionLog(live.priv) as ActionLog;
    expect(log.entries.some((e) => e.kind === "timeout" && e.phase === "Wait")).toBe(true);

    const { states } = replayLog(durDefinition, log, {
      state: freshDur(),
      options: {},
      players: 1,
    });
    expect(states.at(-1)).toEqual(JSON.parse(JSON.stringify(live.state)) as DurState);
  });
});

describe("QA probe R.8 — replay transition assertion", () => {
  const session = (): ActionLog => {
    const table = new FTable();
    table.start();
    table.tick(1000);
    return getActionLog(table.priv) as ActionLog;
  };

  // A fresh init per test: replayLog drives the passed state object in place.
  const init = () => ({ state: newState(), options: { rounds: 2 }, players: 2 });

  it("throws when a transition entry's `to` was tampered with, naming the mismatch", () => {
    const log = session();
    const tampered: ActionLog = {
      ...log,
      entries: log.entries.map((e) =>
        e.kind === "transition" && e.to === "Score" ? { ...e, to: "Play" } : e,
      ),
    };
    expect(() => replayLog(fullDefinition, tampered, init())).toThrow(/(Score|Play)/);
  });

  it("throws when a transition entry's `from` was tampered with, naming the mismatch", () => {
    const log = session();
    const tampered: ActionLog = {
      ...log,
      entries: log.entries.map((e) =>
        e.kind === "transition" && e.to === "Score" ? { ...e, from: "Lobby" } : e,
      ),
    };
    expect(() => replayLog(fullDefinition, tampered, init())).toThrow(/(Play|Score)/);
  });

  it("throws when an enter entry's phase was tampered with, naming the mismatch", () => {
    const log = session();
    const tampered: ActionLog = {
      ...log,
      entries: log.entries.map((e) =>
        e.kind === "enter" && e.phase === "Score" ? { ...e, phase: "Play" } : e,
      ),
    };
    expect(() => replayLog(fullDefinition, tampered, init())).toThrow(/(Play|Score)/);
  });

  it("throws when a transition and its enter are tampered consistently, naming the mismatch", () => {
    const log = session();
    // Consistent with each other (chain checks pass) but not with what the runtime actually did.
    const tampered: ActionLog = {
      ...log,
      entries: log.entries.map((e) => {
        if (e.kind === "transition" && e.to === "Score") return { ...e, to: "Play" };
        if (e.kind === "enter" && e.phase === "Score") return { ...e, phase: "Play" };
        return e;
      }),
    };
    expect(() => replayLog(fullDefinition, tampered, init())).toThrow(/(Play|Score)/);
  });
});

describe("QA probe R.9 — roster-change limitation", () => {
  it("throws a clear v1-limitation error naming the entry and phase, not a deep-equal failure later", () => {
    const table = new FTable();
    table.start();
    table.joinLate("p3"); // mid-game (Play) roster change
    const log = getActionLog(table.priv) as ActionLog;
    expect(log.entries.some((e) => e.kind === "roster-change" && e.phase === "Play")).toBe(true);
    expect(() =>
      replayLog(fullDefinition, log, { state: newState(), options: { rounds: 2 }, players: 2 }),
    ).toThrow('mid-game roster changes are not replayable in v1 (entry 5 in phase "Play")');
  });
});

describe("QA probe R.10 — clock scripting", () => {
  it("a timeout fires only once the clock reaches its logged t, even when that is after enter + duration", () => {
    const table = new FTable();
    table.start(); // Play timer nominally to 1_001_000
    table.act("p2", "PING", { n: 1 }); // at t=1_000_000
    table.tick(1000); // timeout logged at 1_001_000
    const log = getActionLog(table.priv) as ActionLog;

    // Simulate a live room whose tick-quantized clock fired the timeout late (at 1_001_100), with a
    // player action in between: non-uniform gaps, action at t=…050, timeout at t=…100.
    const timeout = log.entries.find((e) => e.kind === "timeout");
    if (timeout === undefined)
      throw new Error("QA probe R.10: expected a timeout entry in the live log");
    // The live log continues past the timeout with its transition and enter; keep them, at the skewed time.
    const afterTimeout = log.entries.slice(log.entries.indexOf(timeout) + 1);
    const skewed: ActionLog = {
      ...log,
      entries: [
        ...log.entries.slice(0, 5), // through the first PING (seq 1..5)
        {
          seq: 6,
          t: 1_001_050,
          phase: "Play",
          kind: "action" as const,
          actionType: "PING",
          senderId: "p2",
          payload: { n: 2 },
        },
        { ...timeout, seq: 7, t: 1_001_100 }, // the skewed timeout
        ...afterTimeout.map((e, k) => ({ ...e, seq: 8 + k, t: 1_001_100 })),
      ],
    };

    const { states } = replayLog(fullDefinition, skewed, {
      state: newState(),
      options: { rounds: 2 },
      players: 2,
    });
    // The replayed timer is scheduled at the logged time — not enter + duration — so it cannot fire early.
    expect(states[3]?.phaseEndsAt).toBe(1_001_100);
    // An action between enter + duration and the logged timeout was accepted in Play, proving the
    // timer had not fired yet; a replay that fired early would have rejected it (WRONG_PHASE).
    expect(states[3]?.pings).toEqual([1, 2]);
    expect(states.at(-1)).toEqual({
      phase: "Score",
      phaseEndsAt: 0,
      canStart: false,
      pings: [1, 2],
      deep: "",
    });
  });
});

describe("QA probe R.11 — middleware interplay with a throwing observer", () => {
  // Repo convention (PR #2): an observing middleware delegates inward first, then does its own work.
  const throwingObserver = (): PhaseMiddleware<S, P, O> => (ctx, next) => {
    if (ctx.event.kind === "transition") {
      next();
      throw new Error("observer boom");
    }
    next();
  };

  it.each([
    ["log outer, throwing inner", [actionLogMiddleware(), throwingObserver()]],
    ["throwing outer, log inner", [throwingObserver(), actionLogMiddleware()]],
  ])("%s: the transition still applies and the log records it", (_label, middleware) => {
    const table = new FTable(middleware);
    expect(() => table.start()).toThrow("observer boom"); // PR #2: observer throws surface
    expect(table.phase).toBe("Play"); // …but never cancel the observed transition
    const log = getActionLog(table.priv);
    expect(
      log?.entries.some((e) => e.kind === "transition" && e.from === "Lobby" && e.to === "Play"),
    ).toBe(true);
  });
});

describe("QA probe R.12 — enter phase field", () => {
  it("an enter entry's phase is the phase being entered, after each transition", () => {
    const table = new FTable();
    table.start();
    table.tick(1000);
    const log = getActionLog(table.priv) as ActionLog;
    const firstEnter = log.entries.find((e) => e.kind === "enter" && e.phase !== "Lobby");
    expect(firstEnter).toEqual({ seq: 4, t: 1_000_000, phase: "Play", kind: "enter" }); // Play, not Lobby
    const lastEnter = log.entries.filter((e) => e.kind === "enter").at(-1);
    expect(lastEnter).toEqual({ seq: 7, t: 1_001_000, phase: "Score", kind: "enter" }); // Score, not Play
  });
});

describe("QA probe R.13 — frozen priv edge", () => {
  it("a frozen private state never yields a half-written log; the failure is loud, not silent", () => {
    const frozenDefinition = defineGame<S, P, O>({
      ...fullDefinition,
      middleware: [actionLogMiddleware()],
      createPrivateState: () => Object.freeze({ secret: "s" }),
    });
    let table: TestTable<S, P, O> | undefined;
    let constructionError: unknown;
    try {
      table = new TestTable({
        definition: frozenDefinition,
        state: newState(),
        options: { rounds: 2 },
        players: 2,
      });
    } catch (error) {
      constructionError = error;
    }
    // No partial log in either case: the write to priv[ACTION_LOG] fails atomically.
    expect(getActionLog(table?.priv ?? {})).toBeUndefined();
    if (constructionError === undefined) {
      // Deferred like any hook failure (PR #2 semantics): the next runtime op must surface it loudly.
      const t = required(table, "QA probe R.13 table");
      expect(() => t.start()).toThrow(TypeError);
    } else {
      expect(constructionError).toBeInstanceOf(TypeError);
    }
  });
});
