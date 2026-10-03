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
      },
    },
    Done: {},
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
