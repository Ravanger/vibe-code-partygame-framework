import { describe, expect, it } from "vitest";
import { z } from "zod";
import { actionFactory, defineGame, mulberry32, type PhaseState } from "../../src/index.js";
import { TestTable } from "../../src/testing/index.js";

interface TapState extends PhaseState {
  taps: number;
  rosterCalls: number;
}

const action = actionFactory<TapState, { marker: string }, Record<string, never>>();

const makeDefinition = (minPlayers = 2) =>
  defineGame<TapState, { marker: string }, Record<string, never>>({
    name: "Tap",
    minPlayers,
    maxPlayers: 6,
    startPhase: "Tap",
    createPrivateState: () => ({ marker: "secret" }),
    phases: {
      Tap: {
        duration: 1000,
        onTimeout: (ctx) => ctx.transition("Done"),
        onRosterChange: (ctx) => {
          ++ctx.state.rosterCalls;
        },
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

const newState = (): TapState => ({
  phase: "",
  phaseEndsAt: 0,
  canStart: false,
  taps: 0,
  rosterCalls: 0,
});

const table = (players?: number, minPlayers = 2) =>
  new TestTable({
    definition: makeDefinition(minPlayers),
    state: newState(),
    options: {},
    ...(players === undefined ? {} : { players }),
  });

describe("TestTable", () => {
  it("seats p1..p4 by default, p1 hosting, and p1..pN when asked", () => {
    const t = table();
    expect(t.ids()).toEqual(["p1", "p2", "p3", "p4"]);
    expect(t.host.seats[0]?.role).toBe("host");
    expect(table(2).ids()).toEqual(["p1", "p2"]);
  });

  it("applies per-seat overrides to the pre-seated players, in seat order", () => {
    const t = new TestTable({
      definition: makeDefinition(),
      state: newState(),
      options: {},
      players: 3,
      seats: [{}, { isReady: false }, { isActive: false, isConnected: false }],
    });
    expect(t.host.seats.map((s) => [s.id, s.isReady, s.isActive, s.isConnected])).toEqual([
      ["p1", true, true, true],
      ["p2", false, true, true],
      ["p3", true, false, false],
    ]);
  });

  it("starts the game from the first seat", () => {
    const t = table();
    expect(t.phase).toBe("Lobby");
    expect(t.start()).toBeUndefined();
    expect(t.phase).toBe("Tap");
    expect(t.state.phase).toBe("Tap");
  });

  it("returns and records the refusal when there are too few players", () => {
    const t = table(2, 3);
    expect(t.start()?.code).toBe("NOT_ENOUGH_PLAYERS");
    expect(t.errors("p1").map((e) => e.code)).toEqual(["NOT_ENOUGH_PLAYERS"]);
  });

  it("acts through the runtime, returning undefined or the refusal", () => {
    const t = table();
    t.start();
    expect(t.act("p2", "TAP", { by: 3 })).toBeUndefined();
    expect(t.state.taps).toBe(3);
    expect(t.act("p2", "NOPE")?.code).toBe("UNKNOWN_ACTION");
  });

  it("lists only ERROR sends, and only well-formed ones", () => {
    const t = table();
    t.host.send("p1", "OTHER", { code: "UNKNOWN_ACTION", message: "x" });
    t.host.send("p1", "ERROR", "junk");
    expect(t.errors("p1")).toEqual([]);
    t.act("p1", "NOPE");
    expect(t.errors("p1")).toHaveLength(1);
  });

  it("advances the manual clock", () => {
    const t = table();
    t.start();
    t.tick(999);
    expect(t.phase).toBe("Tap");
    t.tick(1);
    expect(t.phase).toBe("Done");
  });

  it("exposes the private state", () => {
    expect(table().priv).toEqual({ marker: "secret" });
  });

  it("seeds the room RNG and starts the clock where asked", () => {
    const t = new TestTable({
      definition: makeDefinition(),
      state: newState(),
      options: {},
      players: 2,
      seed: 42,
      startTime: 5_000_000,
    });
    expect(t.host.seed).toBe(42);
    const expected = mulberry32(42);
    for (let i = 0; i < 5; ++i) expect(t.host.rng()).toBe(expected());
    expect(t.host.now()).toBe(5_000_000);
  });

  it("removes a seat and runs the roster hook", () => {
    const t = table();
    t.start();
    t.leave("p2");
    expect(t.ids()).toEqual(["p1", "p3", "p4"]);
    expect(t.state.rosterCalls).toBe(1);
  });

  it("drops and rejoins a seat", () => {
    const t = table();
    t.start();
    t.drop("p2");
    expect(t.host.seats[1]?.isConnected).toBe(false);
    t.rejoin("p2");
    expect(t.host.seats[1]?.isConnected).toBe(true);
    expect(t.state.rosterCalls).toBe(2);
  });

  it("throws for an unknown seat", () => {
    expect(() => table().drop("p9")).toThrow("No seat p9");
    expect(() => table().rejoin("p9")).toThrow("No seat p9");
  });

  it("seats an inactive late joiner who cannot act", () => {
    const t = table();
    t.start();
    t.joinLate("p5");
    expect(t.ids()).toContain("p5");
    expect(t.act("p5", "TAP")?.code).toBe("NOT_ACTIVE");
  });
});
