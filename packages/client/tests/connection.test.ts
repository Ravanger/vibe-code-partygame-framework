import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameConnectionManager } from "../src/connection.js";

vi.mock("@colyseus/sdk", () => ({
  Client: vi.fn().mockImplementation(() => ({
    joinOrCreate: vi.fn().mockResolvedValue({
      sessionId: "test-session",
      onStateChange: vi.fn(),
      onLeave: vi.fn(),
    }),
  })),
}));

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
    const mockClient = Client as unknown as ReturnType<typeof vi.fn>;
    mockClient.mockImplementation(() => ({
      joinOrCreate: vi.fn().mockRejectedValue(new Error("Connection refused")),
    }));

    const manager = new GameConnectionManager("ws://localhost:2567");
    await expect(manager.connect("wit_clash", {})).rejects.toThrow();
    expect(manager.connectionStatus).toBe("error");
  });

  it("should pass options to joinOrCreate", async () => {
    const { Client } = await import("@colyseus/sdk");
    const joinOrCreateSpy = vi.fn().mockResolvedValue({
      sessionId: "test-session",
      onStateChange: vi.fn(),
      onLeave: vi.fn(),
    });
    const mockClient = Client as unknown as ReturnType<typeof vi.fn>;
    mockClient.mockImplementation(() => ({
      joinOrCreate: joinOrCreateSpy,
    }));

    const manager = new GameConnectionManager("ws://localhost:2567");
    await manager.connect("my_room", { code: "TEST123", playerName: "Alice" });
    expect(joinOrCreateSpy).toHaveBeenCalledWith("my_room", {
      code: "TEST123",
      playerName: "Alice",
    });
  });
});
