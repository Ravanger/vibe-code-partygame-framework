import { describe, expect, it, vi } from "vitest";

describe("Server Entry Point", () => {
  it("should create and start the game server", async () => {
    vi.restoreAllMocks();

    const define = vi.fn();
    const listen = vi.fn();
    const serverFactory = vi.fn(() => ({ define, listen }));
    const createServer = vi.fn(() => ({ tag: "http-server" }));
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    vi.doMock("colyseus", () => ({
      Server: serverFactory,
    }));
    vi.doMock("node:http", () => ({
      createServer,
    }));
    vi.doMock("../src/rooms/GameRoom.js", () => ({
      GameRoom: class MockGameRoom {},
    }));

    await import("../src/index.js");

    expect(createServer).toHaveBeenCalled();
    expect(serverFactory).toHaveBeenCalledWith({ server: { tag: "http-server" } });
    expect(define).toHaveBeenCalledWith("game", expect.any(Function));
    expect(listen).toHaveBeenCalledWith(2567);
    expect(info).toHaveBeenCalledWith("[GameServer] Listening on port 2567");

    info.mockRestore();
  });
});
