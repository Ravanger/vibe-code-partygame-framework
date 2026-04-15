import { Client } from "colyseus.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameClient } from "../src/GameClient.js";

vi.mock("colyseus.js", () => {
  const Room = vi.fn(() => ({
    onStateChange: vi.fn(),
    onLeave: vi.fn(),
    send: vi.fn(),
    sessionId: "test-session-id",
  }));
  const Client = vi.fn(() => ({
    joinOrCreate: vi.fn().mockResolvedValue(new Room()),
  }));
  return { Client, Room };
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
    const mockJoinOrCreate = vi.fn().mockRejectedValue(new Error("Join failed"));
    (Client as Mock).mockImplementationOnce(
      () =>
        ({
          joinOrCreate: mockJoinOrCreate,
        }) as unknown as Client,
    );

    const failClient = new GameClient({ endpoint: "ws://localhost" });
    await expect(failClient.join("fail")).rejects.toThrow("Join failed");
    expect(failClient.connectionStatus).toBe("error");
  });
});
