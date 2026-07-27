import { describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";
import { buildXStateMachine } from "../src/machine.js";

describe("XState Machine", () => {
  it("should initialize with correct phase", () => {
    const mockDef = {
      name: "test",
      minPlayers: 1,
      maxPlayers: 2,
      initialState: () => ({}),
      phases: {},
    };
    const machine = buildXStateMachine(mockDef);
    const actor = createActor(machine);
    actor.start();
    expect(actor.getSnapshot().context.currentPhase).toBe("Lobby");
  });

  it("should handle action in a registered phase", () => {
    const handler = vi.fn((ctx) => {
      ctx.state.score = (ctx.state.score ?? 0) + 1;
    });
    const mockDef = {
      name: "test",
      minPlayers: 1,
      maxPlayers: 2,
      initialState: () => ({ score: 0 }),
      phases: {
        Lobby: {
          actions: {
            GAIN_POINT: { from: "player" as const, handler },
          },
        },
      },
    };
    const machine = buildXStateMachine(mockDef);
    const actor = createActor(machine);
    actor.start();

    actor.send({
      type: "ACTION",
      name: "GAIN_POINT",
      clientId: "p1",
      data: null,
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(actor.getSnapshot().context.gameState.score).toBe(1);
  });

  it("should return unchanged context when phase is not registered", () => {
    const mockDef = {
      name: "test",
      minPlayers: 1,
      maxPlayers: 2,
      initialState: () => ({ score: 0 }),
      phases: {},
    };
    const machine = buildXStateMachine(mockDef);
    const actor = createActor(machine);
    actor.start();

    const before = actor.getSnapshot().context;

    actor.send({
      type: "ACTION",
      name: "UNKNOWN_ACTION",
      clientId: "p1",
      data: null,
    });

    expect(actor.getSnapshot().context.gameState).toEqual(before.gameState);
  });

  it("should return unchanged context when action is not registered in phase", () => {
    const mockDef = {
      name: "test",
      minPlayers: 1,
      maxPlayers: 2,
      initialState: () => ({ score: 0 }),
      phases: {
        Lobby: {
          actions: {
            SOME_ACTION: { from: "player" as const, handler: vi.fn() },
          },
        },
      },
    };
    const machine = buildXStateMachine(mockDef);
    const actor = createActor(machine);
    actor.start();

    actor.send({
      type: "ACTION",
      name: "UNKNOWN_ACTION",
      clientId: "p1",
      data: null,
    });

    expect(actor.getSnapshot().context.gameState.score).toBe(0);
  });

  it("should transition phase when handler sets state.phase", () => {
    const handler = vi.fn((ctx) => {
      ctx.state.phase = "Voting";
    });
    const mockDef = {
      name: "test",
      minPlayers: 1,
      maxPlayers: 2,
      initialState: () => ({}),
      phases: {
        Lobby: {
          actions: {
            START_VOTING: { from: "host" as const, handler },
          },
        },
      },
    };
    const machine = buildXStateMachine(mockDef);
    const actor = createActor(machine);
    actor.start();

    actor.send({
      type: "ACTION",
      name: "START_VOTING",
      clientId: "host",
      data: null,
    });

    expect(actor.getSnapshot().context.currentPhase).toBe("Voting");
  });

  it("should stay in same phase when handler does not change phase", () => {
    const handler = vi.fn(() => {});
    const mockDef = {
      name: "test",
      minPlayers: 1,
      maxPlayers: 2,
      initialState: () => ({}),
      phases: {
        Lobby: {
          actions: {
            NO_OP: { from: "player" as const, handler },
          },
        },
      },
    };
    const machine = buildXStateMachine(mockDef);
    const actor = createActor(machine);
    actor.start();

    actor.send({
      type: "ACTION",
      name: "NO_OP",
      clientId: "p1",
      data: null,
    });

    expect(actor.getSnapshot().context.currentPhase).toBe("Lobby");
  });

  it("should route to checkPhase and settle on correct target", () => {
    const handler = vi.fn((ctx) => {
      ctx.state.phase = "Results";
    });
    const mockDef = {
      name: "test",
      minPlayers: 1,
      maxPlayers: 2,
      initialState: () => ({}),
      phases: {
        Lobby: {
          actions: {
            END_GAME: { from: "host" as const, handler },
          },
        },
      },
    };
    const machine = buildXStateMachine(mockDef);
    const actor = createActor(machine);
    actor.start();

    actor.send({
      type: "ACTION",
      name: "END_GAME",
      clientId: "host",
      data: null,
    });

    expect(actor.getSnapshot().context.currentPhase).toBe("Results");
    expect(actor.getSnapshot().value).toBe("Results");
  });

  it("should pass clientId and data to handler", () => {
    const handler = vi.fn();
    const mockDef = {
      name: "test",
      minPlayers: 1,
      maxPlayers: 2,
      initialState: () => ({}),
      phases: {
        Lobby: {
          actions: {
            SUBMIT: { from: "player" as const, handler },
          },
        },
      },
    };
    const machine = buildXStateMachine(mockDef);
    const actor = createActor(machine);
    actor.start();

    actor.send({
      type: "ACTION",
      name: "SUBMIT",
      clientId: "player-42",
      data: { answer: "test answer" },
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "player-42",
        data: { answer: "test answer" },
      }),
    );
  });
});
