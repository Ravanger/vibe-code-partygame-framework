import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  type ActionLog,
  actionFactory,
  actionLogMiddleware,
  defineGame,
  type GameDefinition,
  getActionLog,
  type PhaseState,
} from "../../src/index.js";
import { replayLog } from "../../src/testing/index.js";
import { TestTable } from "../../src/testing/TestTable.js";

interface TickState extends PhaseState {
  pos: number;
  taps: number;
}
interface TickPriv {
  ticks: number;
  dts: number[];
  flips: number;
}
type TickSpec = GameDefinition<TickState, TickPriv, Record<string, never>>;

const action = actionFactory<TickState, TickPriv, Record<string, never>>();
const noPayload = z.object({});

/** A game whose ticking phases advance `pos` by the tick interval on every tick. */
function makeDefinition(): TickSpec {
  return defineGame<TickState, TickPriv, Record<string, never>>({
    name: "Tick",
    version: "1",
    minPlayers: 1,
    maxPlayers: 4,
    startPhase: "Ticking",
    createPrivateState: () => ({ ticks: 0, dts: [], flips: 0 }),
    phases: {
      Ticking: {
        duration: 1050,
        onTick: (ctx, dtMs) => {
          ctx.priv.ticks += 1;
          ctx.priv.dts.push(dtMs);
          ctx.state.pos += dtMs;
        },
        onTimeout: (ctx) => ctx.transition("Done"),
        actions: {
          TAP: action({
            from: "player",
            payload: noPayload,
            handler: (ctx) => {
              ctx.state.taps += 1;
            },
          }),
          SLOW: action({
            from: "host",
            payload: noPayload,
            handler: (ctx) => ctx.transition("Slow"),
          }),
          QUIT: action({
            from: "host",
            payload: noPayload,
            handler: (ctx) => ctx.transition("Quiet"),
          }),
          RESTART: action({
            from: "host",
            payload: noPayload,
            handler: (ctx) => ctx.transition("Ticking"),
          }),
          GO: action({
            from: "host",
            payload: noPayload,
            handler: (ctx) => ctx.transition("Countdown"),
          }),
          BOOM_GO: action({
            from: "host",
            payload: noPayload,
            handler: (ctx) => ctx.transition("Boom"),
          }),
          HOME: action({
            from: "host",
            payload: noPayload,
            handler: (ctx) => ctx.returnToLobby(),
          }),
        },
      },
      // A slower custom rate.
      Slow: {
        duration: 1100,
        tickMs: 250,
        onTick: (ctx, dtMs) => {
          ctx.priv.ticks += 1;
          ctx.priv.dts.push(dtMs);
          ctx.state.pos += dtMs;
        },
        onTimeout: (ctx) => ctx.transition("Done"),
      },
      // Ticks itself out of the game.
      Countdown: {
        tickMs: 100,
        onTick: (ctx) => {
          ctx.priv.flips += 1;
          if (ctx.priv.flips === 3) ctx.transition("Done");
        },
      },
      // Fails on its first tick.
      Boom: {
        tickMs: 100,
        onTick: (ctx) => {
          ctx.state.pos += 1;
          throw new Error("tick boom");
        },
      },
      Quiet: { duration: 400, onTimeout: () => {} },
      Done: {},
    },
  });
}

const newState = (): TickState => ({ phase: "", phaseEndsAt: 0, canStart: false, pos: 0, taps: 0 });

const table = (): TestTable<TickState, TickPriv, Record<string, never>> =>
  new TestTable({ definition: makeDefinition(), state: newState(), options: {}, players: 2 });

describe("PhaseDefinition.onTick", () => {
  it("ticks at the default 10 Hz while the phase is active and stops once it is left", () => {
    const t = table();
    t.start();
    t.tick(950);
    expect(t.priv.ticks).toBe(9);
    expect(t.priv.dts.every((dt) => dt === 100)).toBe(true);
    expect(t.state.pos).toBe(900);
    expect(t.phase).toBe("Ticking");
    t.tick(100); // the tick at +1000, then the phase timeout at +1050
    expect(t.priv.ticks).toBe(10);
    expect(t.state.pos).toBe(1000);
    expect(t.phase).toBe("Done");
    t.tick(2000);
    expect(t.priv.ticks).toBe(10);
  });

  it("honours a per-phase tickMs", () => {
    const t = table();
    t.start();
    expect(t.act("p1", "SLOW")).toBeUndefined();
    t.tick(1050);
    expect(t.priv.ticks).toBe(4); // 250, 500, 750, 1000
    expect(t.priv.dts.every((dt) => dt === 250)).toBe(true);
    expect(t.state.pos).toBe(1000);
    expect(t.phase).toBe("Slow"); // its timeout at +1100 has not fired yet
    t.tick(50);
    expect(t.phase).toBe("Done");
    expect(t.priv.ticks).toBe(4);
  });

  it("stops ticking when the phase is left early", () => {
    const t = table();
    t.start();
    t.tick(250);
    expect(t.priv.ticks).toBe(2);
    expect(t.act("p1", "QUIT")).toBeUndefined();
    expect(t.phase).toBe("Quiet");
    t.tick(2000);
    expect(t.priv.ticks).toBe(2);
    expect(t.host.pendingTimers).toBe(0);
  });

  it("stops ticking on returnToLobby", () => {
    const t = table();
    t.start();
    t.tick(150);
    expect(t.act("p1", "HOME")).toBeUndefined();
    expect(t.phase).toBe("Lobby");
    t.tick(2000);
    expect(t.priv.ticks).toBe(1);
  });

  it("restarts the cadence when the phase re-enters itself", () => {
    const t = table();
    t.start();
    t.tick(250);
    expect(t.act("p1", "RESTART")).toBeUndefined();
    t.tick(150);
    expect(t.priv.ticks).toBe(3); // exactly one tick since the re-entry
  });

  it("stops the old phase's ticks when onTick queues a transition", () => {
    const t = table();
    t.start();
    t.tick(100);
    expect(t.act("p1", "GO")).toBeUndefined();
    t.tick(300);
    expect(t.phase).toBe("Done");
    expect(t.priv.flips).toBe(3);
    t.tick(500);
    expect(t.priv.flips).toBe(3);
  });

  it("applies the failure policy and stops ticking when onTick throws", () => {
    const t = table();
    t.start();
    expect(t.act("p1", "BOOM_GO")).toBeUndefined();
    expect(() => t.tick(100)).toThrow("tick boom");
    expect(t.phase).toBe("Lobby");
    expect(t.state.notice).toBe("The game stopped because of an unexpected error.");
    expect(t.state.pos).toBe(1);
    t.tick(500);
    expect(t.state.pos).toBe(1);
  });

  it("clears the tick timer on stop()", () => {
    const t = table();
    t.start();
    t.tick(150);
    t.runtime.stop();
    expect(t.host.pendingTimers).toBe(0);
    t.tick(2000);
    expect(t.priv.ticks).toBe(1);
  });

  it("is reproduced by replayLog", () => {
    const definition = makeDefinition();
    const live = new TestTable({
      definition: { ...definition, middleware: [actionLogMiddleware()] },
      state: newState(),
      options: {},
      players: 2,
    });
    live.start();
    live.tick(350); // ticks at 100, 200, 300
    expect(live.act("p2", "TAP")).toBeUndefined();
    live.tick(400); // ticks at 400..700
    expect(live.act("p2", "TAP")).toBeUndefined();
    live.tick(300); // ticks at 800, 900, 1000; the timeout at 1050
    const log = getActionLog(live.priv);
    expect(log).toBeDefined();
    const { states } = replayLog(definition, log as ActionLog, {
      state: newState(),
      options: {},
      players: 2,
    });
    const last = states[states.length - 1];
    expect(last).toMatchObject({ phase: "Done", pos: 1000, taps: 2 });
  });
});
