import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameConnectionManager } from "../src/connection.svelte.js";

let shouldFail = false;
let joinByIdShouldWait = false;
let resolveJoinById: Array<(room: unknown) => void> = [];

const createResolveCodeFetch = () =>
  vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify({ roomId: "test-room-id" }), { status: 200 })),
  );

// A distinct room object per call, so identity assertions about connection reuse mean
// something — a shared literal would satisfy `toBe` even with no reuse at all.
const createMockRoom = () => {
  const state = { phase: "Lobby", roomCode: "TEST", players: new Map() };
  const stateChangeCallbacks: Array<(updatedState: typeof state) => void> = [];

  return {
    sessionId: "test-session",
    state,
    onLeave: vi.fn(),
    onStateChange: vi.fn((callback: (updatedState: typeof state) => void) => {
      stateChangeCallbacks.push(callback);
    }),
    triggerStateChange() {
      for (const callback of stateChangeCallbacks) {
        callback(state);
      }
    },
  };
};

vi.mock("@colyseus/sdk", () => {
  class MockClient {}

  // Use prototype methods so tests can override them
  // biome-ignore lint/suspicious/noExplicitAny: mocking prototype
  (MockClient.prototype as any).joinOrCreate = vi.fn(() => {
    if (shouldFail) return Promise.reject(new Error("Connection refused"));
    return Promise.resolve(createMockRoom());
  });
  // biome-ignore lint/suspicious/noExplicitAny: mocking prototype
  (MockClient.prototype as any).create = vi.fn(() => Promise.resolve(createMockRoom()));
  // biome-ignore lint/suspicious/noExplicitAny: mocking prototype
  (MockClient.prototype as any).joinById = vi.fn(() => {
    if (!joinByIdShouldWait) return Promise.resolve(createMockRoom());

    return new Promise((resolve) => {
      resolveJoinById.push(resolve);
    });
  });

  // Expose MockClient for test overrides via globalThis
  // biome-ignore lint/suspicious/noExplicitAny: globalThis requires any type assertion
  (globalThis as any).__MockClient = MockClient;

  return { Client: MockClient };
});

// biome-ignore lint/suspicious/noExplicitAny: mock class reference
const MockClientClass = (globalThis as any).__MockClient;

describe("GameConnectionManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldFail = false;
    joinByIdShouldWait = false;
    resolveJoinById = [];
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

  it("should increment state version when the room state changes", async () => {
    const manager = new GameConnectionManager("ws://localhost:2567");
    const room = await manager.create("wit_clash", { name: "Host" });

    expect(manager.stateVersion).toBe(0);
    (room as unknown as { triggerStateChange: () => void }).triggerStateChange();

    expect(manager.stateVersion).toBe(1);
  });

  it("should have room with state when joining by code", async () => {
    global.fetch = createResolveCodeFetch();

    const manager = new GameConnectionManager("ws://localhost:2567");
    await manager.joinByCode("TEST");
    expect(manager.room).toBeDefined();
    expect(manager.room?.state).toEqual({ phase: "Lobby", roomCode: "TEST", players: new Map() });

    // Clean up
    delete global.fetch;
  });

  it("should reuse the existing room when joining by code after already connected", async () => {
    global.fetch = createResolveCodeFetch();

    const manager = new GameConnectionManager("ws://localhost:2567");
    const firstRoom = await manager.joinByCode("TEST");
    const secondRoom = await manager.joinByCode("TEST");

    expect(secondRoom).toBe(firstRoom);
    expect(global.fetch).toHaveBeenCalledOnce();

    delete global.fetch;
  });

  it("should reuse the pending connection when join by code is clicked twice before it resolves", async () => {
    global.fetch = createResolveCodeFetch();
    joinByIdShouldWait = true;

    const manager = new GameConnectionManager("ws://localhost:2567");
    const firstJoin = manager.joinByCode("TEST");
    const secondJoin = manager.joinByCode("TEST");
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (const resolve of resolveJoinById) {
      resolve(createMockRoom());
    }

    const [firstRoom, secondRoom] = await Promise.all([firstJoin, secondJoin]);

    expect(secondRoom).toBe(firstRoom);
    expect(global.fetch).toHaveBeenCalledOnce();

    delete global.fetch;
  });

  it("allows joining a different code while connected", async () => {
    global.fetch = createResolveCodeFetch();

    const manager = new GameConnectionManager("ws://localhost:2567");
    const firstRoom = await manager.joinByCode("TEST");
    const secondRoom = await manager.joinByCode("ABCD");

    expect(secondRoom).not.toBe(firstRoom);
    expect(global.fetch).toHaveBeenCalledTimes(2);

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
    // biome-ignore lint/suspicious/noExplicitAny: mock class prototype manipulation
    (MockClientClass.prototype as any).joinOrCreate = mockFn;
    const m = new GameConnectionManager("http://localhost:2567");
    await expect(m.connect("wit_clash")).rejects.toThrow();
    expect(m.connectionStatus).toBe("error");
    expect(m.error).toBe("Room not found");
  });

  it("records the failure message when create fails", async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error("Server down"));
    // biome-ignore lint/suspicious/noExplicitAny: mock class prototype manipulation
    (MockClientClass.prototype as any).create = mockFn;
    const m = new GameConnectionManager("http://localhost:2567");
    await expect(m.create("wit_clash")).rejects.toThrow();
    expect(m.connectionStatus).toBe("error");
    expect(m.error).toBe("Server down");
  });

  it("clears the previous error when a new attempt succeeds", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: mock class prototype manipulation
    (MockClientClass.prototype as any).joinOrCreate = vi.fn().mockRejectedValue(new Error("first"));
    const m = new GameConnectionManager("http://localhost:2567");
    await expect(m.connect("wit_clash")).rejects.toThrow();
    expect(m.error).toBe("first");

    // biome-ignore lint/suspicious/noExplicitAny: mock class prototype manipulation
    (MockClientClass.prototype as any).joinOrCreate = vi.fn().mockResolvedValue(makeFakeRoom());
    await m.connect("wit_clash");
    expect(m.error).toBeUndefined();
    expect(m.connectionStatus).toBe("connected");
  });

  it("reset() returns to a clean disconnected state", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: mock class prototype manipulation
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
    // biome-ignore lint/suspicious/noExplicitAny: mock class prototype manipulation
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
    // biome-ignore lint/suspicious/noExplicitAny: mock class prototype manipulation
    (MockClientClass.prototype as any).create = vi.fn().mockResolvedValue(fakeRoom2);
    const room = await m.create("wit_clash");
    expect(room.roomId).toBe("room-2");
    expect(m.connectionStatus).toBe("connected");
  });
});
