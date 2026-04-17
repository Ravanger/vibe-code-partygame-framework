import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameConnectionManager } from "../src/connection.svelte.js";

let shouldFail = false;

vi.mock("@colyseus/sdk", () => {
  class MockClient {
    joinOrCreate = vi.fn(() => {
      if (shouldFail) return Promise.reject(new Error("Connection refused"));
      return Promise.resolve({ sessionId: "test-session", onLeave: vi.fn() });
    });
    create = vi.fn(() => Promise.resolve({ sessionId: "test-session", onLeave: vi.fn() }));
    joinById = vi.fn(() => Promise.resolve({ sessionId: "test-session", onLeave: vi.fn() }));
  }

  // biome-ignore lint/suspicious/noExplicitAny: mocking prototype
  (MockClient.prototype as any).joinOrCreate = vi.fn();
  // biome-ignore lint/suspicious/noExplicitAny: mocking prototype
  (MockClient.prototype as any).create = vi.fn();
  // biome-ignore lint/suspicious/noExplicitAny: mocking prototype
  (MockClient.prototype as any).joinById = vi.fn();

  return { Client: MockClient };
});

describe("GameConnectionManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldFail = false;
  });

  it("should initialize with disconnected status", () => {
    const manager = new GameConnectionManager("ws://localhost:2567");
    expect(manager.connectionStatus).toBe("disconnected");
  });

  it("should create a room and set status to connected", async () => {
    const manager = new GameConnectionManager("ws://localhost:2567");
    await manager.create("wit_clash", { name: "Host" });
    expect(manager.connectionStatus).toBe("connected");
    expect(manager.room).toBeDefined();
    expect(manager.room?.sessionId).toBe("test-session");
  });

  it("should join a room and set status to connected", async () => {
    const manager = new GameConnectionManager("ws://localhost:2567");
    await manager.join("wit_clash", { code: "ABCD" });
    expect(manager.connectionStatus).toBe("connected");
    expect(manager.room).toBeDefined();
    expect(manager.room?.sessionId).toBe("test-session");
  });

  it("should connect to a room and set status to connected", async () => {
    const manager = new GameConnectionManager("ws://localhost:2567");
    await manager.connect("wit_clash", { code: "ABCD" });
    expect(manager.connectionStatus).toBe("connected");
    expect(manager.room).toBeDefined();
    expect(manager.room?.sessionId).toBe("test-session");
  });

  it("should set status to error when join fails", async () => {
    shouldFail = true;
    const manager = new GameConnectionManager("ws://localhost:2567");
    await expect(manager.connect("wit_clash", {})).rejects.toThrow();
    expect(manager.connectionStatus).toBe("error");
  });
});
