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
});
