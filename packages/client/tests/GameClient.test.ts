import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameClient } from "../src/GameClient.js";

vi.mock("colyseus.js", () => ({
  Client: vi.fn().mockImplementation(() => ({
    joinOrCreate: vi.fn().mockResolvedValue({
      sessionId: "session1",
      onStateChange: vi.fn(),
      onLeave: vi.fn(),
      send: vi.fn(),
    }),
  })),
}));

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
    await client.join("room1");

    const mockRoom = client.room;
    if (!mockRoom) return;
    const stateChangeCallback = (mockRoom.onStateChange as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    stateChangeCallback({ phase: "Voting", publicData: '{"key":"value"}', roomCode: "TEST123" });

    expect(client.state.phase).toBe("Voting");
    expect(client.state.publicData).toBe('{"key":"value"}');
    expect(client.state.roomCode).toBe("TEST123");
  });

  it("should set disconnected status on leave", async () => {
    const client = new GameClient({ endpoint: "http://localhost:3000" });
    await client.join("room1");

    const mockRoom = client.room;
    if (!mockRoom) return;
    const leaveCallback = (mockRoom.onLeave as ReturnType<typeof vi.fn>).mock.calls[0][0];
    leaveCallback(1000);

    expect(client.connectionStatus).toBe("disconnected");
  });
});
