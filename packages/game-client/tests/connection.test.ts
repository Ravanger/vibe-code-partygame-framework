import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameConnectionManager } from "../src/connection.svelte.js";

let shouldFail = false;

vi.mock("@colyseus/sdk", async (importOriginal) => {
  const original = await importOriginal();
  class MockClient {}

  // Use prototype methods so tests can override them
  // biome-ignore lint/suspicious/noExplicitAny: mocking prototype
  (MockClient.prototype as any).joinOrCreate = vi.fn(() => {
    if (shouldFail) return Promise.reject(new Error("Connection refused"));
    return Promise.resolve({
      sessionId: "test-session",
      state: { phase: "Lobby", roomCode: "TEST", players: new Map() },
      onLeave: vi.fn(),
      onStateChange: vi.fn(),
    });
  });
  // biome-ignore lint/suspicious/noExplicitAny: mocking prototype
  (MockClient.prototype as any).create = vi.fn(() =>
    Promise.resolve({
      sessionId: "test-session",
      state: { phase: "Lobby", roomCode: "TEST", players: new Map() },
      onLeave: vi.fn(),
      onStateChange: vi.fn(),
    }),
  );
  // biome-ignore lint/suspicious/noExplicitAny: mocking prototype
  (MockClient.prototype as any).joinById = vi.fn(() =>
    Promise.resolve({
      sessionId: "test-session",
      state: { phase: "Lobby", roomCode: "TEST", players: new Map() },
      onLeave: vi.fn(),
      onStateChange: vi.fn(),
    }),
  );

  // Expose MockClient for test overrides via globalThis
  (globalThis as any).__MockClient = MockClient;

  return { ...original, Client: MockClient };
});

// biome-ignore lint/suspicious/noExplicitAny: mock class reference
const MockClientClass = (globalThis as any).__MockClient;

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

  it("should have room with state when created", async () => {
    const manager = new GameConnectionManager("ws://localhost:2567");
    await manager.create("wit_clash", { name: "Host" });
    expect(manager.room).toBeDefined();
    expect(manager.room?.state).toEqual({ phase: "Lobby", roomCode: "TEST", players: new Map() });
  });

  it("should have room with state when joining by code", async () => {
    // Mock fetch for joinByCode
    // biome-ignore lint/suspicious/noExplicitAny: mock fetch return type
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ roomId: "test-room-id" }),
        status: 200,
      }),
    ) as any;

    const manager = new GameConnectionManager("ws://localhost:2567");
    await manager.joinByCode("TEST");
    expect(manager.room).toBeDefined();
    expect(manager.room?.state).toEqual({ phase: "Lobby", roomCode: "TEST", players: new Map() });

    // Clean up
    delete global.fetch;
  });
});

describe("GameConnectionManager error reporting", () => {
  function makeFakeRoom(overrides = {}) {
    return {
      sessionId: "test-session",
      roomId: "test-room",
      state: { phase: "Lobby", roomCode: "TEST", players: new Map() },
      onLeave: vi.fn(),
      onStateChange: vi.fn(),
      onMessage: vi.fn(),
      send: vi.fn(),
      ...overrides,
    };
  }

  it("starts with no error", () => {
    const m = new GameConnectionManager("http://localhost:2567");
    expect(m.error).toBeUndefined();
  });

  it("records the failure message when connect fails", async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error("Room not found"));
    (MockClientClass.prototype as any).joinOrCreate = mockFn;
    const m = new GameConnectionManager("http://localhost:2567");
    await expect(m.connect("wit_clash")).rejects.toThrow();
    expect(m.connectionStatus).toBe("error");
    expect(m.error).toBe("Room not found");
  });

  it("records the failure message when create fails", async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error("Server down"));
    (MockClientClass.prototype as any).create = mockFn;
    const m = new GameConnectionManager("http://localhost:2567");
    await expect(m.create("wit_clash")).rejects.toThrow();
    expect(m.connectionStatus).toBe("error");
    expect(m.error).toBe("Server down");
  });

  it("clears the previous error when a new attempt succeeds", async () => {
    (MockClientClass.prototype as any).joinOrCreate = vi.fn().mockRejectedValue(new Error("first"));
    const m = new GameConnectionManager("http://localhost:2567");
    await expect(m.connect("wit_clash")).rejects.toThrow();
    expect(m.error).toBe("first");

    (MockClientClass.prototype as any).joinOrCreate = vi.fn().mockResolvedValue(makeFakeRoom());
    await m.connect("wit_clash");
    expect(m.error).toBeUndefined();
    expect(m.connectionStatus).toBe("connected");
  });

  it("reset() returns to a clean disconnected state", async () => {
    (MockClientClass.prototype as any).joinOrCreate = vi.fn().mockRejectedValue(new Error("boom"));
    const m = new GameConnectionManager("http://localhost:2567");
    await expect(m.connect("wit_clash")).rejects.toThrow();
    m.reset();
    expect(m.connectionStatus).toBe("disconnected");
    expect(m.error).toBeUndefined();
    expect(m.room).toBeUndefined();
  });
});

describe("GameConnectionManager reconnection", () => {
  function makeFakeRoom(overrides = {}) {
    return {
      sessionId: "test-session",
      roomId: "test-room",
      state: { phase: "Lobby", roomCode: "TEST", players: new Map() },
      onLeave: vi.fn(),
      onStateChange: vi.fn(),
      onMessage: vi.fn(),
      send: vi.fn(),
      ...overrides,
    };
  }

  it("allows a fresh create() after the room has been left", async () => {
    const m = new GameConnectionManager("http://localhost:2567");
    let storedLeaveCallback: ((code: number) => void) | undefined;
    const fakeRoom1 = makeFakeRoom({
      roomId: "room-1",
      onLeave: vi.fn((cb: (code: number) => void) => {
        storedLeaveCallback = cb;
      }),
    });
    (MockClientClass.prototype as any).create = vi.fn().mockResolvedValue(fakeRoom1);
    await m.create("wit_clash");
    expect(m.connectionStatus).toBe("connected");
    expect(m.room?.roomId).toBe("room-1");

    // Simulate being kicked from the room
    storedLeaveCallback?.(1000);
    expect(m.connectionStatus).toBe("disconnected");
    expect(m.room).toBeUndefined();

    // Fresh create should work
    const fakeRoom2 = makeFakeRoom({ roomId: "room-2" });
    (MockClientClass.prototype as any).create = vi.fn().mockResolvedValue(fakeRoom2);
    const room = await m.create("wit_clash");
    expect(room.roomId).toBe("room-2");
    expect(m.connectionStatus).toBe("connected");
  });
});
