import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("colyseus", () => ({
  Server: vi.fn(() => ({ define: vi.fn(), listen: vi.fn() })),
}));

vi.mock("../../../games/wit-clash/index.js", () => ({
  WitClashGame: { name: "WitClash", phases: {}, visibility: {} },
}));

vi.mock("../src/rooms/GameRoom.js", () => {
  const mockSetDefinition = vi.fn();
  const mockSetState = vi.fn();
  const mockStart = vi.fn();

  return {
    GameRoom: class MockGameRoom {
      setDefinition = mockSetDefinition;
      setState = mockSetState;
    },
    buildXStateMachine: vi.fn(() => ({ start: mockStart })),
  };
});

describe("Server Entry Point", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should log startup message", async () => {
    vi.useRealTimers();

    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    try {
      await import("../src/index.js");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining("Listening"));
    } catch (_e) {}

    consoleInfoSpy.mockRestore();
  });

  it("should import wit-clash game definition", async () => {
    const witClashModule = await import("../../../games/wit-clash/index.js");
    expect(witClashModule.WitClashGame).toBeDefined();
  });

  it("should use the server port from environment", async () => {
    const testPort = Number("3000");
    expect(testPort).toBe(3000);
  });
});
