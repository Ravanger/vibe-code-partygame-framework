import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameClient } from "../src/GameClient.js";

vi.mock("@colyseus/sdk", () => {
  class MockRoom {
    sessionId = "test-session-id";
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
  let client: GameClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GameClient({ endpoint: "ws://localhost" });
  });

  it("should initialize with correct connection status", () => {
    expect(client.connectionStatus).toBe("disconnected");
    expect(client.state).toBeDefined();
  });

  it("should join a room and update status", async () => {
    const room = await client.join("game_room");
    expect(client.connectionStatus).toBe("connected");
    expect(client.room).toBeDefined();
    expect(room).toBeDefined();
  });

  it("should send messages when connected", async () => {
    await client.join("game_room");
    client.send("TEST_ACTION", { data: 123 });
    expect(client.room?.send).toHaveBeenCalledWith("TEST_ACTION", { data: 123 });
  });

  it("should throw error when sending without connection", () => {
    expect(() => client.send("TEST")).toThrow("Cannot send message");
  });

  it("should return playerId when connected", async () => {
    await client.join("game_room");
    expect(client.playerId).toBe("test-session-id");
  });

  it("should handle join error", async () => {
    const { Client } = await import("@colyseus/sdk");
    const originalJoinOrCreate = Client.prototype.joinOrCreate as vi.Mock;
    // Use mockImplementationOnce to reject once, then restore
    originalJoinOrCreate.mockImplementationOnce(() => Promise.reject(new Error("Join failed")));

    const failClient = new GameClient({ endpoint: "ws://localhost" });
    await expect(failClient.join("fail")).rejects.toThrow("Join failed");
    expect(failClient.connectionStatus).toBe("error");

    // Restore - create a new mock that returns a room
    originalJoinOrCreate.mockImplementation(() =>
      Promise.resolve({
        sessionId: "test-session-id",
        send: vi.fn(),
        onStateChange: vi.fn(),
        onLeave: vi.fn(),
      }),
    );
  });
});
