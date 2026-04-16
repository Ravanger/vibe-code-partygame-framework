import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameConnectionManager } from "../src/connection.js";

vi.mock("@colyseus/sdk", () => {
  class MockClient {}
  MockClient.prototype.joinOrCreate = vi.fn(() => Promise.resolve({ sessionId: "test-session" }));

  return { Client: MockClient };
});

describe("GameConnectionManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with disconnected status", () => {
    const manager = new GameConnectionManager("ws://localhost:2567");
    expect(manager.connectionStatus).toBe("disconnected");
  });

  it("should connect to a room and set status to connected", async () => {
    const manager = new GameConnectionManager("ws://localhost:2567");
    await manager.connect("wit_clash", { code: "ABCD" });
    expect(manager.connectionStatus).toBe("connected");
    expect(manager.room).toBeDefined();
    expect(manager.room?.sessionId).toBe("test-session");
  });

  it("should set status to error when join fails", async () => {
    const { Client } = await import("@colyseus/sdk");
    const originalJoinOrCreate = Client.prototype.joinOrCreate;
    Client.prototype.joinOrCreate = vi.fn().mockRejectedValueOnce(new Error("Connection refused"));

    const manager = new GameConnectionManager("ws://localhost:2567");
    await expect(manager.connect("wit_clash", {})).rejects.toThrow();
    expect(manager.connectionStatus).toBe("error");

    Client.prototype.joinOrCreate = originalJoinOrCreate;
  });

  it("should pass options to joinOrCreate", async () => {
    const { Client } = await import("@colyseus/sdk");
    const originalJoinOrCreate = Client.prototype.joinOrCreate;

    // Reset the mock for this test
    originalJoinOrCreate.mockReset();

    const manager = new GameConnectionManager("ws://localhost:2567");
    await manager.connect("my_room", { code: "TEST123", playerName: "Alice" });
    expect(originalJoinOrCreate).toHaveBeenCalledWith("my_room", {
      code: "TEST123",
      playerName: "Alice",
    });

    Client.prototype.joinOrCreate = originalJoinOrCreate;
  });
});
