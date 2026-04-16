import { describe, it, expect, vi } from "vitest";
import { GameConnectionManager } from "../src/connection.js";
import { Client } from "colyseus.js";

vi.mock("colyseus.js", () => {
  return {
    Client: vi.fn().mockImplementation(() => ({
      joinOrCreate: vi.fn().mockResolvedValue({
        sessionId: "test-session",
        onStateChange: vi.fn(),
        onLeave: vi.fn(),
      }),
    })),
  };
});

describe("GameConnectionManager", () => {
  it("should initialize with disconnected status", () => {
    const manager = new GameConnectionManager("ws://localhost:2567");
    expect(manager.connectionStatus).toBe("disconnected");
  });

  it("should connect to a room", async () => {
    const manager = new GameConnectionManager("ws://localhost:2567");
    await manager.connect("wit_clash", { code: "ABCD" });
    expect(manager.connectionStatus).toBe("connected");
  });
});
