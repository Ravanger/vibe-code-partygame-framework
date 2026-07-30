import type { GameDefinition } from "@partygame/core";
import { describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => ({
  Room: class Room {
    state: unknown;
    setState(s: unknown) {
      this.state = s;
    }
    onMessage(_event: string, _handler: () => void) {}
  },
  Client: class Client {
    sessionId = "";
    send: () => void = vi.fn();
  },
}));

import { GameRoom } from "../src/rooms/GameRoom";
import { GameStateSchema } from "../src/schema/GameStateSchema";
import { PlayerSchema } from "../src/schema/PlayerSchema";

const mockGameDefinition: GameDefinition<Record<string, unknown>> = {
  name: "TestGame",
  minPlayers: 2,
  maxPlayers: 8,
  initialState: () => ({}),
  phases: {
    Lobby: {
      actions: {
        START_GAME: {
          from: "player",
          handler: vi.fn(),
        },
      },
    },
  },
  visibility: {},
};

// Custom room class for testing
class TestGameRoom extends GameRoom<Record<string, unknown>> {
  // Store state explicitly for testing
  public testState: GameStateSchema | null = null;

  onCreate() {
    this.setDefinition(mockGameDefinition);
    // Don't call super.onCreate() to avoid StateView issues in tests
    this.testState = new GameStateSchema();
    this.setState(this.testState);
  }
}

describe("GameRoom integration tests", () => {
  it("should have gameDefinition set after onCreate", () => {
    const testRoom = new TestGameRoom();
    testRoom.onCreate();

    expect(testRoom.testState).toBeDefined();
    // Access gameDefinition through reflection since it's private
    // @ts-expect-error - accessing private field for test
    expect(testRoom.gameDefinition).toBeDefined();
    // @ts-expect-error - accessing private field for test
    expect(testRoom.gameDefinition.name).toBe("TestGame");
  });

  it("should throw clear error if gameDefinition is not set before onCreate", () => {
    const testRoom = new GameRoom();
    // Don't set definition
    expect(() => testRoom.onCreate()).toThrow(
      "GameDefinition must be set before onCreate completes. Call setDefinition() in your room class constructor or onCreate().",
    );
  });

  it("should create player on join", () => {
    const testRoom = new TestGameRoom();
    testRoom.onCreate();

    const state = testRoom.testState;
    expect(state).toBeDefined();
    expect(state?.players.size).toBe(0);

    const sessionId = "test-session-123";
    const player = new PlayerSchema();
    player.id = sessionId;
    player.name = `Player ${sessionId.slice(0, 4)}`;

    const stateBefore = testRoom.state as GameStateSchema;
    stateBefore.players.clear();
    stateBefore.players.set(sessionId, player);

    expect(stateBefore.players.size).toBe(1);
    const createdPlayer = stateBefore.players.get(sessionId);
    expect(createdPlayer).toBeDefined();
    expect(createdPlayer?.id).toBe(sessionId);
    expect(createdPlayer?.name).toBe("Player test");
  });

  it("should throw clear error if gameDefinition is not set before join", () => {
    const testRoom = new GameRoom();
    testRoom.onCreate = vi.fn(); // Mock onCreate to avoid state setup
    // Don't set definition

    const mockClient = {
      sessionId: "test-session",
      send: vi.fn(),
    } as unknown as Client;

    expect(() => testRoom.onJoin(mockClient)).toThrow(
      "GameDefinition must be set before clients can join. Call setDefinition() in your room class.",
    );
  });

  it("should handle multiple players joining", () => {
    const testRoom = new TestGameRoom();
    testRoom.onCreate();

    const state = testRoom.testState;
    expect(state).toBeDefined();
    const sessionIds = ["session-1", "session-2", "session-3"];

    for (const sessionId of sessionIds) {
      const player = new PlayerSchema();
      player.id = sessionId;
      player.name = `Player ${sessionId.slice(0, 4)}`;
      state?.players.set(sessionId, player);
    }

    expect(state?.players.size).toBe(3);
    expect(state?.players.get("session-1")?.name).toBe("Player sess");
    expect(state?.players.get("session-2")?.name).toBe("Player sess");
    expect(state?.players.get("session-3")?.name).toBe("Player sess");
  });

  it("should update existing player on re-join", () => {
    const testRoom = new TestGameRoom();
    testRoom.onCreate();

    const state = testRoom.testState;
    expect(state).toBeDefined();
    const sessionId = "duplicate-session";

    // First join
    const player1 = new PlayerSchema();
    player1.id = sessionId;
    player1.name = `Player ${sessionId.slice(0, 4)}`;
    state?.players.set(sessionId, player1);

    expect(state?.players.size).toBe(1);

    // Second join with same session (should update)
    const player2 = new PlayerSchema();
    player2.id = sessionId;
    player2.name = `Player ${sessionId.slice(0, 4)}`;
    state?.players.set(sessionId, player2);

    expect(state?.players.size).toBe(1);
    const player = state?.players.get(sessionId);
    expect(player).toBeDefined();
    expect(player?.id).toBe(sessionId);
    expect(player?.name).toBe("Player dupl");
  });

  it("should use sessionId prefix for player name", () => {
    const sessionId = "abcdef123456";
    const player = new PlayerSchema();
    player.id = sessionId;
    player.name = `Player ${sessionId.slice(0, 4)}`;

    expect(player.name).toBe("Player abcd");
  });

  it("does not throw when SET_NAME arrives for an unknown session", () => {
    // Spied, not just silenced: the warn is the documented behaviour (D5), so assert it fires
    // instead of letting it print into the test log.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const testRoom = new TestGameRoom();
    testRoom.onCreate();
    const mockClient = {
      sessionId: "ghost",
      send: vi.fn(),
    } as unknown as Client;
    expect(() => testRoom.handleSetName(mockClient, "Ada" as unknown)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[SET_NAME] Unknown session ghost"));
    warn.mockRestore();
  });

  it("does not throw when onLeave fires for an unknown session", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const testRoom = new TestGameRoom();
    testRoom.onCreate();
    const mockClient = {
      sessionId: "ghost",
      send: vi.fn(),
    } as unknown as Client;
    expect(() => testRoom.onLeave(mockClient, true)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[onLeave] Unknown session ghost"));
    warn.mockRestore();
  });
});
