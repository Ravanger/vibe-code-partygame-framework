import type { TextFilter } from "@partygame/content/filter";
import { PROTOCOL_VERSION } from "@partygame/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MAX_ACTION_LOG_ENTRIES } from "../src/actionLog.js";
import {
  type ActionLog,
  type ActionLogEntry,
  actionFactory,
  actionLogMiddleware,
  defineGame,
  getActionLog,
  type PhaseState,
  required,
  seedFromNumber,
  sfc32,
  shuffle,
  textFilterMiddleware,
} from "../src/index.js";
import { replayLog } from "../src/replay/index.js";
import { TestTable } from "../src/testing/TestTable.js";
import { MAX_TIMER_FIRES_PER_ADVANCE, MAX_TIMER_FIRES_PER_REPLAY } from "../src/timers.js";

interface S extends PhaseState {
  taps: number;
}

const action = actionFactory<S, { marker: string }, Record<string, never>>();

const definition = defineGame<S, { marker: string }, Record<string, never>>({
  name: "TapReplay",
  version: "1",
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
  version: "1",
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

  it("throws when the log was recorded for another version", () => {
    const live = liveTable();
    live.start();
    const other = defineGame<S, { marker: string }, Record<string, never>>({
      ...definition,
      version: "2",
    });
    expect(() =>
      replayLog(other, getActionLog(live.priv) as ActionLog, {
        state: newState(),
        options: {},
        players: 2,
      }),
    ).toThrow('log was recorded for version "1", not "2"');
  });

  it("throws when the log predates versioning (no header.version)", () => {
    const live = liveTable();
    live.start();
    const log = getActionLog(live.priv) as ActionLog;
    delete log.header.version;
    expect(() =>
      replayLog(definition, log, {
        state: newState(),
        options: {},
        players: 2,
      }),
    ).toThrow("log.header.version is missing; the log predates versioned logs");
  });

  it("throws when the log was recorded with another protocol version", () => {
    const live = liveTable();
    live.start();
    const log = getActionLog(live.priv) as ActionLog;
    log.header.protocolVersion = 9;
    expect(() =>
      replayLog(definition, log, {
        state: newState(),
        options: {},
        players: 2,
      }),
    ).toThrow(`log was recorded with protocol version 9, not ${PROTOCOL_VERSION}`);
  });

  it("throws when the log predates protocol versioning (no header.protocolVersion)", () => {
    const live = liveTable();
    live.start();
    const log = getActionLog(live.priv) as ActionLog;
    delete log.header.protocolVersion;
    expect(() =>
      replayLog(definition, log, {
        state: newState(),
        options: {},
        players: 2,
      }),
    ).toThrow(
      `log.header.protocolVersion is missing (the log predates protocol versioning); expected ${PROTOCOL_VERSION}`,
    );
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
    // p3 joined the Lobby before start, so the recorded roster already includes it; the recorded
    // roster wins and init.players (3 here) is ignored
    const { states } = replayLog(definition, log, { state: newState(), options: {}, players: 3 });
    expect(states.at(-1)).toEqual({ phase: "Done", phaseEndsAt: 0, canStart: false, taps: 0 });
  });

  it("replays an auto-started session that recorded no roster to the same final state", () => {
    const auto = { ...definition, autoStart: true };
    const live = new TestTable({
      definition: { ...auto, middleware: [actionLogMiddleware()] },
      state: newState(),
      options: {},
      players: 2,
      seats: [{}, { isReady: false }],
    });
    // p2 is not ready yet: this roster change does not start the game.
    live.runtime.rosterChanged();
    expect(live.phase).toBe("Lobby");
    required(live.host.seats[1], "p2").isReady = true;
    live.runtime.rosterChanged(); // everyone ready now: auto-start fires
    expect(live.phase).toBe("Tap");
    live.act("p2", "TAP", { by: 3 });
    const log = getActionLog(live.priv);
    expect(log).toBeDefined();
    // No START_GAME was dispatched, so the roster is recorded when the session leaves the Lobby.
    expect((log as ActionLog).roster).toEqual([
      { id: "p1", isConnected: true, isReady: true, isActive: true },
      { id: "p2", isConnected: true, isReady: true, isActive: true },
    ]);

    const { states } = replayLog(auto, log as ActionLog, {
      state: newState(),
      options: {},
      players: 2,
    });
    expect(states.at(-1)).toEqual(live.state);
  });

  it("throws when entry times go backwards", () => {
    const live = liveTable();
    live.start();
    const log = getActionLog(live.priv) as ActionLog;
    const [first, second] = log.entries;
    const backwards: ActionLog = {
      ...log,
      entries: [
        required(first, "first entry"),
        { ...required(second, "second entry"), t: 999_999 },
      ],
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
    const seed7 = seedFromNumber(7);
    const seed8 = seedFromNumber(8);
    expect(fromHeader.states.at(-1)?.roll).toBe(Math.floor(sfc32(seed7)() * 100));
    expect(fromInit.states.at(-1)?.roll).toBe(Math.floor(sfc32(seed8)() * 100));
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
      roster: [
        { id: "aaaa-1", isConnected: true, isReady: true, isActive: true },
        { id: "bbbb-2", isConnected: true, isReady: true, isActive: true },
      ],
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
      roster: [
        { id: "aaaa-1", isConnected: true, isReady: true, isActive: true },
        { id: "bbbb-2", isConnected: true, isReady: true, isActive: true },
      ],
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

describe("replayLog log-shape validation", () => {
  const init = { state: newState(), options: {} } as const;

  function liveLog(): ActionLog {
    const live = liveTable();
    live.start();
    return getActionLog(live.priv) as ActionLog;
  }

  it("throws a named error when log.entries is missing", () => {
    const log = liveLog();
    expect(() =>
      replayLog(definition, { header: log.header } as unknown as ActionLog, init),
    ).toThrow("replayLog: log.entries must be an array");
  });

  it("throws a named error when log.entries is not an array", () => {
    const log = liveLog();
    expect(() =>
      replayLog(definition, { ...log, entries: "nope" } as unknown as ActionLog, init),
    ).toThrow("replayLog: log.entries must be an array");
  });

  it("throws a named error when the header is missing or null", () => {
    const log = liveLog();
    expect(() =>
      replayLog(definition, { entries: log.entries } as unknown as ActionLog, init),
    ).toThrow("replayLog: log.header must be an object");
    expect(() =>
      replayLog(definition, { header: null, entries: log.entries } as unknown as ActionLog, init),
    ).toThrow("replayLog: log.header must be an object");
  });

  it("throws a named error when the log has no entries", () => {
    const log = liveLog();
    const empty: ActionLog = { header: log.header, entries: [] };
    expect(() => replayLog(definition, empty, init)).toThrow("replayLog: the log has no entries");
  });

  it("names the allowed range for an out-of-bounds t, seq or startedAt", () => {
    const max = Number.MAX_SAFE_INTEGER;
    const log = liveLog();
    expect(() =>
      replayLog(definition, withEntry(log, 1, { ...log.entries[1], t: -1 }), init),
    ).toThrow(`"t" must be an integer between 0 and ${max}`);
    expect(() =>
      replayLog(definition, withEntry(log, 1, { ...log.entries[1], t: max + 1 }), init),
    ).toThrow(`"t" must be an integer between 0 and ${max}`);
    expect(() =>
      replayLog(definition, withEntry(log, 1, { ...log.entries[1], seq: 0 }), init),
    ).toThrow(`"seq" must be an integer between 1 and ${max}`);
    expect(() =>
      replayLog(definition, { ...log, header: { ...log.header, startedAt: -1 } }, init),
    ).toThrow(`log.header.startedAt must be an integer between 0 and ${max}`);
  });

  it("throws a named error when header.game is not a string", () => {
    const log = liveLog();
    expect(() =>
      replayLog(
        definition,
        { ...log, header: { ...log.header, game: 42 } } as unknown as ActionLog,
        init,
      ),
    ).toThrow("replayLog: log.header.game must be a string");
  });

  it("throws a named error when header.seed is not a 4-tuple of numbers", () => {
    const log = liveLog();
    expect(() =>
      replayLog(
        definition,
        { ...log, header: { ...log.header, seed: "x" } } as unknown as ActionLog,
        init,
      ),
    ).toThrow("replayLog: log.header.seed must be an array of 4 numbers");
  });

  it("throws a named error when header.startedAt is not a number", () => {
    const log = liveLog();
    expect(() =>
      replayLog(
        definition,
        { ...log, header: { ...log.header, startedAt: "x" } } as unknown as ActionLog,
        init,
      ),
    ).toThrow("replayLog: log.header.startedAt must be a number");
  });

  it("throws a named error when log.roster is not an array", () => {
    const log = liveLog();
    expect(() =>
      replayLog(definition, { ...log, roster: "nope" } as unknown as ActionLog, init),
    ).toThrow("replayLog: log.roster must be an array");
  });

  it("throws a named error when a roster entry is not an object", () => {
    const log = liveLog();
    expect(() =>
      replayLog(definition, { ...log, roster: [null] } as unknown as ActionLog, init),
    ).toThrow('malformed roster entry null: "id" must be a string');
  });

  it("throws a named error when a roster entry is missing fields", () => {
    const log = liveLog();
    expect(() =>
      replayLog(definition, { ...log, roster: [{ id: "aaaa-1" }] } as unknown as ActionLog, init),
    ).toThrow('"isConnected" must be a boolean');
  });

  function withEntry(log: ActionLog, index: number, entry: unknown): ActionLog {
    const entries = [...log.entries];
    entries[index] = entry as ActionLogEntry;
    return { ...log, entries };
  }

  it("throws a named error when an entry is not an object", () => {
    const log = liveLog();
    expect(() => replayLog(definition, withEntry(log, 1, null), init)).toThrow(
      "replayLog: malformed log entry null: must be an object",
    );
    expect(() => replayLog(definition, withEntry(log, 1, "nope"), init)).toThrow(
      'replayLog: malformed log entry "nope": must be an object',
    );
  });

  it("throws a named error when an entry is missing its kind", () => {
    // A kind-less entry used to fall through every branch of the walk: no dispatch, but a snapshot
    // still pushed, and tick(NaN) poisoning the clock so every later ordering check went quiet.
    const log = liveLog();
    expect(() => replayLog(definition, withEntry(log, 3, {}), init)).toThrow(
      '"kind" must be one of action, transition, enter, timeout, roster-change',
    );
  });

  it("throws a named error when an entry has an unknown kind", () => {
    const log = liveLog();
    expect(() =>
      replayLog(definition, withEntry(log, 1, { ...log.entries[1], kind: "teleport" }), init),
    ).toThrow('"kind" must be one of action, transition, enter, timeout, roster-change');
  });

  it("throws a named error when an entry's t is not a number", () => {
    const log = liveLog();
    expect(() =>
      replayLog(definition, withEntry(log, 1, { ...log.entries[1], t: "100" }), init),
    ).toThrow('"t" must be a number');
  });

  it("throws a named error when an entry's seq is not a number", () => {
    const log = liveLog();
    expect(() =>
      replayLog(definition, withEntry(log, 1, { ...log.entries[1], seq: "second" }), init),
    ).toThrow('"seq" must be a number');
  });

  it("throws a named error when an entry's phase is not a string", () => {
    const log = liveLog();
    expect(() =>
      replayLog(definition, withEntry(log, 1, { ...log.entries[1], phase: 42 }), init),
    ).toThrow('"phase" must be a string');
  });

  it("throws a named error when an action entry's payload is not a plain object", () => {
    const log = liveLog();
    expect(() =>
      replayLog(definition, withEntry(log, 1, { ...log.entries[1], payload: "abc" }), init),
    ).toThrow('"payload" must be a plain object');
  });

  it("throws a named error when the log has more than MAX_ACTION_LOG_ENTRIES entries", () => {
    const log = liveLog();
    const entry = required(log.entries[0], "first log entry");
    const padded = [...log.entries];
    const extra = MAX_ACTION_LOG_ENTRIES - padded.length + 1;
    for (let i = 0; i < extra; ++i) padded.push(entry);
    expect(() => replayLog(definition, { ...log, entries: padded }, init)).toThrow(
      `replayLog: log.entries has more than ${MAX_ACTION_LOG_ENTRIES} entries`,
    );
  });

  it("throws a named error when the log is not an object", () => {
    const corrupted: unknown = null;
    expect(() => replayLog(definition, corrupted as ActionLog, init)).toThrow(
      "replayLog: log must be an object",
    );
  });

  it("throws a named error for unrecognized fields anywhere in the log", () => {
    const raw = JSON.parse(JSON.stringify(liveLog()));
    expect(() => replayLog(definition, { ...raw, surprise: true } as ActionLog, init)).toThrow(
      "replayLog: log has unrecognized fields",
    );
    expect(() =>
      replayLog(definition, { ...raw, header: { ...raw.header, surprise: 1 } } as ActionLog, init),
    ).toThrow("replayLog: log.header has unrecognized fields");
    const entries = raw.entries.map((entry: object, i: number) =>
      i === 1 ? { ...entry, bonus: 2 } : entry,
    );
    expect(() => replayLog(definition, { ...raw, entries } as ActionLog, init)).toThrow(
      "has unrecognized fields",
    );
    const roster = raw.roster.map((seat: object, i: number) =>
      i === 0 ? { ...seat, extra: true } : seat,
    );
    expect(() => replayLog(definition, { ...raw, roster } as ActionLog, init)).toThrow(
      "has unrecognized fields",
    );
  });

  it("throws a named error for mistyped optional entry and roster fields", () => {
    const raw = JSON.parse(JSON.stringify(liveLog()));
    const rejected = raw.entries.map((entry: object, i: number) =>
      i === 1 ? { ...entry, rejected: "yes" } : entry,
    );
    expect(() => replayLog(definition, { ...raw, entries: rejected } as ActionLog, init)).toThrow(
      '"rejected" must be a boolean',
    );
    const redacted = raw.entries.map((entry: object, i: number) =>
      i === 1 ? { ...entry, redacted: "yes" } : entry,
    );
    expect(() => replayLog(definition, { ...raw, entries: redacted } as ActionLog, init)).toThrow(
      '"redacted" must be a boolean',
    );
    const roster = raw.roster.map((seat: object) => ({ ...seat, id: 7 }));
    expect(() => replayLog(definition, { ...raw, roster } as ActionLog, init)).toThrow(
      '"id" must be a string',
    );
  });
});

describe("replay restores recorded seat flags", () => {
  // A game whose start-phase enter reads the active seats — exactly what diverged when replay
  // pre-seated everyone ready and active while live benched the unready at START_GAME.
  interface BenchState extends PhaseState {
    activeAtEnter: number;
  }

  const benchDefinition = defineGame<BenchState, Record<string, never>, Record<string, never>>({
    name: "Bench",
    version: "1",
    minPlayers: 1,
    maxPlayers: 4,
    startPhase: "Play",
    createPrivateState: () => ({}),
    phases: {
      Play: {
        onEnter: (ctx) => {
          ctx.state.activeAtEnter = ctx.activePlayers().length;
        },
      },
    },
  });

  const newBenchState = (): BenchState => ({
    phase: "",
    phaseEndsAt: 0,
    canStart: false,
    activeAtEnter: 0,
  });

  it("records the seat flags at start and benches an unready seat on replay, exactly like live", () => {
    // Explicit generics: the spread-with-middleware definition would otherwise widen TState to PhaseState.
    const live = new TestTable<BenchState, Record<string, never>, Record<string, never>>({
      definition: { ...benchDefinition, middleware: [actionLogMiddleware()] },
      state: newBenchState(),
      options: {},
      players: 3,
      seats: [{}, {}, { isReady: false }],
    });
    expect(live.start()).toBeUndefined();
    // live benched p3 when leaving the Lobby
    expect(live.state.activeAtEnter).toBe(2);
    const log = getActionLog(live.priv) as ActionLog;
    expect(log.roster).toEqual([
      { id: "p1", isConnected: true, isReady: true, isActive: true },
      { id: "p2", isConnected: true, isReady: true, isActive: true },
      { id: "p3", isConnected: true, isReady: false, isActive: true },
    ]);
    const { states } = replayLog(benchDefinition, log, { state: newBenchState(), options: {} });
    expect(states.at(-1)).toEqual({
      phase: "Play",
      phaseEndsAt: 0,
      canStart: false,
      activeAtEnter: 2,
    });
  });

  it("keeps a lobby joiner inactive at start on replay, exactly like live", () => {
    const live = new TestTable<BenchState, Record<string, never>, Record<string, never>>({
      definition: { ...benchDefinition, middleware: [actionLogMiddleware()] },
      state: newBenchState(),
      options: {},
      players: 2,
    });
    live.joinLate("p3"); // seated ready but inactive while in the Lobby
    expect(live.start()).toBeUndefined();
    expect(live.state.activeAtEnter).toBe(2);
    const log = getActionLog(live.priv) as ActionLog;
    const { states } = replayLog(benchDefinition, log, { state: newBenchState(), options: {} });
    expect(states.at(-1)).toEqual({
      phase: "Play",
      phaseEndsAt: 0,
      canStart: false,
      activeAtEnter: 2,
    });
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
    version: "1",
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
    const stream = sfc32(seedFromNumber(1234));
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

describe("redacted entries", () => {
  interface RS extends PhaseState {
    log: string[];
  }
  const rAction = actionFactory<RS, { secret: string }, Record<string, never>>();
  const redactFilter: TextFilter = {
    check(text) {
      return text.includes("bad") ? { ok: false, reason: "no bad words" } : { ok: true };
    },
  };
  // An empty payload is accepted and changes state: if replay re-dispatched a redacted entry
  // (whose payload was never logged), the final state would diverge from live. Reproducing
  // live requires skipping the entry.
  const definition = defineGame<RS, { secret: string }, Record<string, never>>({
    name: "RedactedReplay",
    version: "1",
    minPlayers: 1,
    maxPlayers: 4,
    startPhase: "Play",
    createPrivateState: () => ({ secret: "s" }),
    filterLevel: () => "moderate",
    phases: {
      Play: {
        actions: {
          MAYBE: rAction({
            from: "player",
            payload: z.object({ text: z.string().optional() }),
            textFields: ["text"],
            handler: (ctx) => ctx.state.log.push(`maybe:${ctx.payload.text ?? ""}`),
          }),
        },
      },
    },
    middleware: [actionLogMiddleware(), textFilterMiddleware(redactFilter)],
  });
  const newState = (): RS => ({ phase: "", phaseEndsAt: 0, canStart: false, log: [] });

  it("skips redacted entries and reproduces the live final state", () => {
    const table = new TestTable<RS, { secret: string }, Record<string, never>>({
      definition,
      state: newState(),
      options: {},
      players: 2,
    });
    table.start();
    table.act("p2", "MAYBE", { text: "fine" });
    table.act("p2", "MAYBE", { text: "a bad one" }); // refused by the filter, redacted in the log
    expect(table.state.log).toEqual(["maybe:fine"]);
    const log = JSON.parse(JSON.stringify(getActionLog(table.priv))) as ActionLog;
    expect(log.entries.some((e) => e.redacted === true)).toBe(true);
    const { states } = replayLog(definition, log, { state: newState(), options: {} });
    const last = required(states[states.length - 1], "final replayed state");
    expect(last.log).toEqual(["maybe:fine"]);
  });
});

describe("replayLog input bounds", () => {
  interface CapState extends PhaseState {
    taps: number;
  }
  const capAction = actionFactory<CapState, Record<string, never>, Record<string, never>>();

  /** A ticking phase at 1 ms: one timer fire per logged millisecond. */
  const capDefinition = defineGame<CapState, Record<string, never>, Record<string, never>>({
    name: "CapTap",
    version: "1",
    minPlayers: 1,
    maxPlayers: 4,
    startPhase: "Tap",
    createPrivateState: () => ({}),
    phases: {
      Tap: {
        tickMs: 1,
        onTick: () => {},
        actions: {
          TAP: capAction({
            from: "player",
            payload: z.object({}),
            handler: (ctx) => {
              ctx.state.taps += 1;
            },
          }),
        },
      },
    },
  });

  const newCapState = (): CapState => ({ phase: "", phaseEndsAt: 0, canStart: false, taps: 0 });

  /** A hand-built log: start at T+100, then `taps` TAPs each `gapMs` later. */
  const capLog = (gapMs: number, taps: number): ActionLog => {
    const entries: ActionLogEntry[] = [
      { seq: 1, t: 1_000_000, phase: "Lobby", kind: "enter" },
      {
        seq: 2,
        t: 1_000_100,
        phase: "Lobby",
        kind: "action",
        actionType: "START_GAME",
        senderId: "p1",
        payload: {},
      },
      { seq: 3, t: 1_000_100, phase: "Lobby", kind: "transition", from: "Lobby", to: "Tap" },
      { seq: 4, t: 1_000_100, phase: "Tap", kind: "enter" },
    ];
    let t = 1_000_100;
    for (let i = 0; i < taps; ++i) {
      t += gapMs;
      entries.push({
        seq: i + 5,
        t,
        phase: "Tap",
        kind: "action",
        actionType: "TAP",
        senderId: "p1",
        payload: {},
      });
    }
    return {
      header: {
        game: "CapTap",
        version: "1",
        protocolVersion: PROTOCOL_VERSION,
        seed: [1, 2, 3, 4],
        startedAt: 1_000_000,
      },
      entries,
    };
  };

  it("refuses a time gap that would fire more than the per-advance budget", () => {
    const log = capLog(MAX_TIMER_FIRES_PER_ADVANCE + 1, 1);
    expect(() =>
      replayLog(capDefinition, log, { state: newCapState(), options: {}, players: 1 }),
    ).toThrow(/replayLog: .*timers/);
  });

  it("refuses a run whose total timer fires exceed the replay budget", () => {
    const gapMs = 9_000; // under the per-advance budget, so only the total can trip
    const taps = Math.floor(MAX_TIMER_FIRES_PER_REPLAY / gapMs) + 2;
    const log = capLog(gapMs, taps);
    expect(() =>
      replayLog(capDefinition, log, { state: newCapState(), options: {}, players: 1 }),
    ).toThrow(/replayLog: .*timers/);
  });

  it("replays a long-but-within-budget ticking session", () => {
    const log = capLog(9_000, Math.floor(MAX_TIMER_FIRES_PER_REPLAY / 9_000));
    const { states } = replayLog(capDefinition, log, {
      state: newCapState(),
      options: {},
      players: 1,
    });
    expect(states.length).toBe(Math.floor(MAX_TIMER_FIRES_PER_REPLAY / 9_000) + 2);
  });
});
