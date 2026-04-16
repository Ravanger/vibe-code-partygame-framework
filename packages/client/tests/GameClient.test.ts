import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameClient } from "../src/GameClient.js";

vi.mock("@colyseus/sdk", () => {
  class MockRoom {
    sessionId = "session1";
    send = vi.fn();
    onStateChange = vi.fn((cb: (...args: unknown[]) => void) => {
      (this as { _stateChangeCb?: (...args: unknown[]) => void })._stateChangeCb = cb;
    });
    onLeave = vi.fn((cb: (...args: unknown[]) => void) => {
      (this as { _leaveCb?: (...args: unknown[]) => void })._leaveCb = cb;
    });
  }

  class MockClient {}
  MockClient.prototype.joinOrCreate = vi.fn().mockResolvedValue(new MockRoom());

  return { Client: MockClient };
});

describe("GameClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with disconnected status", () => {
    const client = new GameClient({ endpoint: "http://localhost:3000" });
    expect(client.connectionStatus).toBe("disconnected");
  });

  it("should throw when sending without room", () => {
    const client = new GameClient({ endpoint: "http://localhost:3000" });
    expect(() => client.send("test")).toThrow("Cannot send message: Not connected to a room.");
  });

  it("should return playerId from room", async () => {
    const client = new GameClient({ endpoint: "http://localhost:3000" });
    await client.join("room1");
    expect(client.playerId).toBe("session1");
  });

  it("should sync state when onStateChange is called", async () => {
    const client = new GameClient({ endpoint: "http://localhost:3000" });
    const room = (await client.join("room1")) as unknown as {
      _stateChangeCb?: (...args: unknown[]) => void;
    };

    // Trigger the state change callback
    room._stateChangeCb?.({
      phase: "Voting",
      publicData: '{"key":"value"}',
      roomCode: "TEST123",
    });

    expect(client.state.phase).toBe("Voting");
    expect(client.state.publicData).toBe('{"key":"value"}');
    expect(client.state.roomCode).toBe("TEST123");
  });

  it("should set disconnected status on leave", async () => {
    const client = new GameClient({ endpoint: "http://localhost:3000" });
    const room = (await client.join("room1")) as unknown as {
      _leaveCb?: (...args: unknown[]) => void;
    };

    room._leaveCb?.(1000);

    expect(client.connectionStatus).toBe("disconnected");
  });
});
