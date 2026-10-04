import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  type ActionLog,
  actionFactory,
  actionLogMiddleware,
  defineGame,
  getActionLog,
  mulberry32,
  type PhaseState,
  replayLog,
  shuffle,
} from "../src/index.js";
import { TestTable } from "../src/testing/TestTable.js";

interface S extends PhaseState {
  taps: number;
}

const action = actionFactory<S, { marker: string }, Record<string, never>>();

const definition = defineGame<S, { marker: string }, Record<string, never>>({
  name: "TapReplay",
  minPlayers: 1,
  maxPlayers: 4,
  startPhase: "Tap",
  createPrivateState: () => ({ marker: "secret" }),
  phases: {
    Tap: {
      duration: 1000,
      onTimeout: (ctx) => ctx.transition("Done"),
      actions: {
        TAP: action({
          from: "player",
          payload: z.object({ by: z.number().default(1) }),
          handler: (ctx) => {
            ctx.state.taps += ctx.payload.by;
          },
        }),
        STAGE: action({
          from: "host",
          payload: z.object({}),
          handler: (ctx) => ctx.transition("Staged"),
        }),
        LOOP: action({
          from: "host",
          payload: z.object({}),
          handler: (ctx) => ctx.transition("Loop"),
        }),
      },
    },
    // Its timeout re-enters the same phase.
    Loop: {
      duration: 300,
      onTimeout: (ctx) => ctx.transition("Loop"),
      actions: {
        UNLOOP: action({
          from: "host",
          payload: z.object({}),
          handler: (ctx) => ctx.transition("Done"),
        }),
      },
    },
    Staged: {
      duration: () => 500,
      onTimeout: (ctx) => ctx.transition("Done"),
      actions: {
        SKIP: action({
          from: "host",
          payload: z.object({}),
          handler: (ctx) => ctx.transition("Done"),
        }),
      },
    },
    // Timed but never entered in the tests below.
    Stowed: {
      duration: 250,
      onTimeout: (ctx) => ctx.transition("Done"),
    },
    Done: {
      actions: {
        FINISH: action({
          from: "host",
          payload: z.object({}),
          handler: (ctx) => {
            ctx.state.taps += 10;
          },
        }),
      },
    },
  },
});

const newState = (): S => ({ phase: "", phaseEndsAt: 0, canStart: false, taps: 0 });

const liveTable = () =>
  new TestTable({
    definition: { ...definition, middleware: [actionLogMiddleware()] },
    state: newState(),
    options: {},
    players: 2,
  });

interface RollState extends PhaseState {
  roll: number;
}

const rollDefinition = defineGame<RollState, Record<string, never>, Record<string, never>>({
  name: "Roll",
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

const newRollState = (): RollState => ({ phase: "", phaseEndsAt: 0, canStart: false, roll: 0 });

describe("replayLog", () => {
  it("re-drives a logged session and returns one snapshot per step plus the initial state", () => {
    const live = liveTable();
    live.start();
    live.act("p2", "TAP", { by: 3 });
    live.tick(1000);
    const log = getActionLog(live.priv);
    expect(log).toBeDefined();

    const { states } = replayLog(definition, log as ActionLog, {
      state: newState(),
      options: {},
      players: 2,
    });
    expect(states).toEqual([
      // construction at header.startedAt (1_000_000), before any entry
      { phase: "Lobby", phaseEndsAt: 0, canStart: true, taps: 0 },
      // after START_GAME: entered Tap, timer to 1_001_000
      { phase: "Tap", phaseEndsAt: 1_001_000, canStart: false, taps: 0 },
      // after TAP by p2 with by: 3
      { phase: "Tap", phaseEndsAt: 1_001_000, canStart: false, taps: 3 },
      // after the Tap timeout: entered Done (no timer)
      { phase: "Done", phaseEndsAt: 0, canStart: false, taps: 3 },
    ]);
    expect(states).toHaveLength(4);
  });

  it("throws when the log was recorded for another game", () => {
    const live = liveTable();
    live.start();
    const other = defineGame<S, { marker: string }, Record<string, never>>({
      ...definition,
      name: "OtherGame",
    });
    expect(() =>
      replayLog(other, getActionLog(live.priv) as ActionLog, {
        state: newState(),
        options: {},
        players: 2,
      }),
    ).toThrow('log was recorded for game "TapReplay", not "OtherGame"');
  });

  it("throws when the first entry is not the construction-time Lobby enter (entry removed)", () => {
    const live = liveTable();
    live.start();
    const log = getActionLog(live.priv) as ActionLog;
    const trimmed: ActionLog = { ...log, entries: log.entries.slice(1) }; // drop the Lobby enter
    expect(() =>
      replayLog(definition, trimmed, { state: newState(), options: {}, players: 2 }),
    ).toThrow(
      'the first log entry must be the construction-time Lobby enter (got action "START_GAME" in phase "Lobby", seq 2)',
    );
  });

  it("throws when the first entry is not the construction-time Lobby enter (phase tampered)", () => {
    const live = liveTable();
    live.start();
    const log = getActionLog(live.priv) as ActionLog;
    const firstEntry = log.entries[0];
    if (firstEntry === undefined) throw new Error("test setup: empty log");
    const tampered: ActionLog = {
      ...log,
      entries: [{ ...firstEntry, phase: "Tap" }, ...log.entries.slice(1)],
    };
    expect(() =>
      replayLog(definition, tampered, { state: newState(), options: {}, players: 2 }),
    ).toThrow(
      'the first log entry must be the construction-time Lobby enter (got "enter" entry in phase "Tap", seq 1)',
    );
  });

  it("throws on a mid-game roster change, naming the entry and phase", () => {
    const live = liveTable();
    live.start();
    live.joinLate("p3"); // roster change while in Tap
    expect(() =>
      replayLog(definition, getActionLog(live.priv) as ActionLog, {
        state: newState(),
        options: {},
        players: 2,
      }),
    ).toThrow('mid-game roster changes are not replayable in v1 (entry 5 in phase "Tap")');
  });

  it("skips lobby-phase roster changes", () => {
    const live = liveTable();
    live.joinLate("p3"); // while still in the Lobby
    live.start();
    live.tick(1000);
    const log = getActionLog(live.priv) as ActionLog;
    expect(log.entries.some((e) => e.kind === "roster-change")).toBe(true);
    // the log records no roster: pre-seat the full table (p3 joined in the Lobby live)
    const { states } = replayLog(definition, log, { state: newState(), options: {}, players: 3 });
    expect(states.at(-1)).toEqual({ phase: "Done", phaseEndsAt: 0, canStart: false, taps: 0 });
  });

  it("throws when entry times go backwards", () => {
    const live = liveTable();
    live.start();
    const log = getActionLog(live.priv) as ActionLog;
    const backwards: ActionLog = {
      ...log,
      entries: [log.entries[0]!, { ...log.entries[1]!, t: 999_999 }],
    };
    expect(() =>
      replayLog(definition, backwards, { state: newState(), options: {}, players: 2 }),
    ).toThrow("before the current clock");
  });

  it("throws when a re-dispatched action is rejected", () => {
    const live = liveTable();
    live.start();
    live.act("p2", "TAP", { by: 3 });
    const log = getActionLog(live.priv) as ActionLog;
    // point the TAP at a seat that was never in the replayed table
    const tampered: ActionLog = {
      ...log,
      entries: log.entries.map((e) => (e.actionType === "TAP" ? { ...e, senderId: "p9" } : e)),
    };
    expect(() =>
      replayLog(definition, tampered, { state: newState(), options: {}, players: 2 }),
    ).toThrow("re-dispatched action TAP was rejected");
  });

  it("treats a malformed action entry as a rejected re-dispatch", () => {
    const live = liveTable();
    live.start();
    const log = getActionLog(live.priv) as ActionLog;
    // strip the optional fields from every action entry
    const stripped: ActionLog = {
      ...log,
      entries: log.entries.map((e) =>
        e.kind === "action" ? { seq: e.seq, t: e.t, phase: e.phase, kind: "action" } : e,
      ),
    };
    expect(() =>
      replayLog(definition, stripped, { state: newState(), options: {}, players: 2 }),
    ).toThrow("re-dispatched action undefined was rejected");
  });

  it("treats logged timeout times as authoritative when they precede enter + duration", () => {
    const live = liveTable();
    live.start();
    live.tick(1000); // Tap timeout -> Done at 1_001_000
    const log = getActionLog(live.priv) as ActionLog;
    // A live room's tick-quantized clock can fire a phase timer a few ms before the nominal
    // enter + duration deadline; replay must honor the logged firing time.
    const skewed: ActionLog = {
      ...log,
      entries: log.entries.map((e) => (e.t === 1_001_000 ? { ...e, t: e.t - 5 } : e)),
    };
    const { states } = replayLog(definition, skewed, {
      state: newState(),
      options: {},
      players: 2,
    });
    expect(states).toEqual([
      { phase: "Lobby", phaseEndsAt: 0, canStart: true, taps: 0 },
      // the replayed timer expires at the logged timeout time, not enter + duration
      { phase: "Tap", phaseEndsAt: 1_000_995, canStart: false, taps: 0 },
      { phase: "Done", phaseEndsAt: 0, canStart: false, taps: 0 },
    ]);
  });

  it("re-dispatches actions after an early logged timeout instead of rejecting them", () => {
    const live = liveTable();
    live.start();
    live.tick(1000); // Tap timeout -> Done at 1_001_000
    live.act("p1", "FINISH"); // host action in Done, same ms as the live firing
    const log = getActionLog(live.priv) as ActionLog;
    // Simulate a skewed live log: the timeout fired 5 ms early and the host reacted 2 ms later.
    const skewed: ActionLog = {
      ...log,
      entries: log.entries.map((e) => {
        if (e.kind === "timeout") return { ...e, t: e.t - 5 };
        if (e.actionType === "FINISH") return { ...e, t: e.t - 2 };
        return e;
      }),
    };
    const { states } = replayLog(definition, skewed, {
      state: newState(),
      options: {},
      players: 2,
    });
    expect(states.at(-1)).toEqual({ phase: "Done", phaseEndsAt: 0, canStart: false, taps: 10 });
  });

  it("keeps the original duration for enters without a logged timeout", () => {
    const live = liveTable();
    live.start();
    live.act("p1", "STAGE"); // Tap leaves early (no timeout); Staged gets a function duration
    live.act("p1", "SKIP"); // Staged leaves early too, so neither enter is paired with a timeout
    const log = getActionLog(live.priv) as ActionLog;
    const { states } = replayLog(definition, log, { state: newState(), options: {}, players: 2 });
    expect(states.at(-1)).toEqual({ phase: "Done", phaseEndsAt: 0, canStart: false, taps: 0 });
  });

  it("falls back to the nominal duration when a timeout has no matching enter", () => {
    const live = liveTable();
    live.start();
    live.tick(1000); // Tap timeout -> Done at 1_001_000
    const log = getActionLog(live.priv) as ActionLog;
    // Drop the enter so the timeout cannot be paired (a malformed log).
    const noEnter: ActionLog = {
      ...log,
      entries: log.entries.filter((e) => !(e.kind === "enter" && e.phase === "Tap")),
    };
    const { states } = replayLog(definition, noEnter, {
      state: newState(),
      options: {},
      players: 2,
    });
    expect(states.at(-1)).toEqual({ phase: "Done", phaseEndsAt: 0, canStart: false, taps: 0 });
  });

  it("pairs each enter of a self-reentering timed phase with its own timeout", () => {
    const live = liveTable();
    live.start();
    live.act("p1", "LOOP"); // Tap -> Loop (300 ms; onTimeout re-enters Loop)
    live.tick(650); // two Loop timeouts: re-enter at +300, timeout again at +600
    live.act("p1", "UNLOOP"); // Loop -> Done
    const log = getActionLog(live.priv) as ActionLog;
    // Skew the first logged timeout 5 ms early (tick-quantized live clocks do this).
    const skewed: ActionLog = {
      ...log,
      entries: log.entries.map((e) =>
        e.kind === "timeout" && e.t === 1_000_300 ? { ...e, t: e.t - 5 } : e,
      ),
    };
    const { states } = replayLog(definition, skewed, {
      state: newState(),
      options: {},
      players: 2,
    });
    expect(states).toEqual([
      { phase: "Lobby", phaseEndsAt: 0, canStart: true, taps: 0 },
      { phase: "Tap", phaseEndsAt: 1_001_000, canStart: false, taps: 0 },
      // the first Loop enter expires at the skewed logged time
      { phase: "Loop", phaseEndsAt: 1_000_295, canStart: false, taps: 0 },
      // re-entry after the first timeout; its timer expires at the second logged timeout
      { phase: "Loop", phaseEndsAt: 1_000_600, canStart: false, taps: 0 },
      // the third enter has no logged timeout (UNLOOP leaves early): nominal duration
      { phase: "Loop", phaseEndsAt: 1_000_900, canStart: false, taps: 0 },
      { phase: "Done", phaseEndsAt: 0, canStart: false, taps: 0 },
    ]);
  });

  it("draws the RNG from the header seed by default and from init.seed when given", () => {
    const live = new TestTable({
      definition: { ...rollDefinition, middleware: [actionLogMiddleware()] },
      state: newRollState(),
      options: {},
      players: 1,
      seed: 7,
    });
    live.start();
    const log = getActionLog(live.priv) as ActionLog;
    const fromHeader = replayLog(rollDefinition, log, {
      state: newRollState(),
      options: {},
      players: 1,
    });
    const fromInit = replayLog(rollDefinition, log, {
      state: newRollState(),
      options: {},
      players: 1,
      seed: 8,
    });
    expect(fromHeader.states.at(-1)?.roll).toBe(Math.floor(mulberry32(7)() * 100));
    expect(fromInit.states.at(-1)?.roll).toBe(Math.floor(mulberry32(8)() * 100));
  });

  it("re-dispatches recorded sender ids through the positional roster map", () => {
    const live = liveTable();
    live.start();
    live.act("p2", "TAP", { by: 3 });
    live.tick(1000);
    const log = getActionLog(live.priv) as ActionLog;
    // rename the seats to client-generated ids, as a real server room would have
    const renamed: ActionLog = {
      ...log,
      roster: ["aaaa-1", "bbbb-2"],
      entries: log.entries.map((e) =>
        e.kind === "action" && e.senderId !== undefined
          ? { ...e, senderId: e.senderId === "p1" ? "aaaa-1" : "bbbb-2" }
          : e,
      ),
    };
    const { states } = replayLog(definition, renamed, { state: newState(), options: {} });
    expect(states).toEqual([
      { phase: "Lobby", phaseEndsAt: 0, canStart: true, taps: 0 },
      { phase: "Tap", phaseEndsAt: 1_001_000, canStart: false, taps: 0 },
      { phase: "Tap", phaseEndsAt: 1_001_000, canStart: false, taps: 3 },
      { phase: "Done", phaseEndsAt: 0, canStart: false, taps: 3 },
    ]);
  });

  it("rejects an action from a sender missing from the recorded roster", () => {
    const live = liveTable();
    live.start();
    live.act("p2", "TAP", { by: 3 });
    const log = getActionLog(live.priv) as ActionLog;
    const stray: ActionLog = {
      ...log,
      roster: ["aaaa-1", "bbbb-2"],
      entries: log.entries.map((e) =>
        e.kind === "action" && e.senderId !== undefined
          ? { ...e, senderId: e.actionType === "START_GAME" ? "aaaa-1" : "cccc-9" }
          : e,
      ),
    };
    expect(() => replayLog(definition, stray, { state: newState(), options: {} })).toThrow(
      "re-dispatched action TAP was rejected",
    );
  });

  it("requires init.players when the log has no recorded roster", () => {
    const live = liveTable();
    live.start();
    const log = getActionLog(live.priv) as ActionLog;
    // a lobby-only session (or an older log) has no roster field at all
    const noRoster: ActionLog = { header: log.header, entries: log.entries };
    expect(() => replayLog(definition, noRoster, { state: newState(), options: {} })).toThrow(
      "the log has no recorded roster; pass init.players",
    );
  });

  it("falls back to init.players when the log has no recorded roster", () => {
    const live = liveTable();
    live.start();
    live.act("p2", "TAP", { by: 3 });
    live.tick(1000);
    const log = getActionLog(live.priv) as ActionLog;
    const noRoster: ActionLog = { header: log.header, entries: log.entries };
    const { states } = replayLog(definition, noRoster, {
      state: newState(),
      options: {},
      players: 2,
    });
    expect(states.at(-1)).toEqual({ phase: "Done", phaseEndsAt: 0, canStart: false, taps: 3 });
  });
});

describe("replay round-trip", () => {
  // Exercises everything the log must survive: seeded rng draws on every enter, timed phases,
  // a self-transition (from === to) that re-enters, and returnToLobby.
  interface SpinState extends PhaseState {
    spins: number;
    roll: number;
    order: number[];
  }

  const spinAction = actionFactory<SpinState, Record<string, never>, Record<string, never>>();

  const spinDefinition = defineGame<SpinState, Record<string, never>, Record<string, never>>({
    name: "Spin",
    minPlayers: 1,
    maxPlayers: 4,
    startPhase: "Spin",
    createPrivateState: () => ({}),
    phases: {
      Spin: {
        duration: 1000,
        onEnter: (ctx) => {
          ctx.state.roll = Math.floor(ctx.rng() * 100);
          ctx.state.order = shuffle([1, 2, 3], ctx.rng);
        },
        onTimeout: (ctx) => ctx.transition("Done"),
        actions: {
          SPIN: spinAction({
            from: "player",
            payload: z.object({ n: z.number().default(1) }),
            handler: (ctx) => {
              ctx.state.spins += ctx.payload.n;
            },
          }),
          REENTRY: spinAction({
            from: "player",
            payload: z.object({}),
            handler: (ctx) => ctx.transition("Spin"),
          }),
        },
      },
      Done: {},
    },
  });

  const newSpinState = (): SpinState => ({
    phase: "",
    phaseEndsAt: 0,
    canStart: false,
    spins: 0,
    roll: 0,
    order: [],
  });

  it("replays a full session (rng, timers, re-entry, return to lobby) to identical states", () => {
    const live = new TestTable({
      definition: { ...spinDefinition, middleware: [actionLogMiddleware()] },
      state: newSpinState(),
      options: {},
      players: 2,
      seed: 1234,
    });
    // ground truth: one deep clone per driven step, construction included
    const snapshots: SpinState[] = [];
    const snapshot = (): SpinState => {
      const copy = JSON.parse(JSON.stringify(live.state)) as SpinState;
      snapshots.push(copy);
      return copy;
    };

    snapshot(); // Lobby at construction
    live.start(); // enter Spin: first rng draws
    const afterStart = snapshot();
    live.act("p2", "SPIN", { n: 3 });
    snapshot();
    live.act("p1", "REENTRY"); // self-transition: re-enter Spin, fresh rng draws
    const afterReentry = snapshot();
    live.tick(1000); // Spin timeout -> Done
    snapshot();
    live.act("p1", "END_GAME"); // return to the Lobby
    snapshot();

    const log = getActionLog(live.priv) as ActionLog;
    // sanity: the log really contains the tricky shapes
    expect(
      log.entries.some((e) => e.kind === "transition" && e.from === "Spin" && e.to === "Spin"),
    ).toBe(true);
    expect(log.entries.filter((e) => e.phase === "Lobby" && e.kind === "enter")).toHaveLength(2);

    // the seeded stream must be visible in state: 3 draws per Spin enter (roll + 2 shuffle), so
    // the REENTRY snapshot holds the 4th draw — proof the self-transition re-entered the phase
    const stream = mulberry32(1234);
    const rollOf = (): number => Math.floor(stream() * 100);
    const skipShuffleDraws = (): void => {
      stream();
      stream();
    };
    const firstEnterRoll = rollOf();
    skipShuffleDraws();
    const reentryRoll = rollOf();
    expect(reentryRoll).not.toBe(firstEnterRoll);
    expect(afterStart.roll).toBe(firstEnterRoll);
    expect(afterReentry.roll).toBe(reentryRoll);

    const { states } = replayLog(spinDefinition, log, {
      state: newSpinState(),
      options: {},
      players: 2,
    });
    expect(states).toEqual(snapshots);
  });
});
