import { describe, expect, it, vi } from "vitest";

describe("Server Entry Point", () => {
  it("should create and start the game server", async () => {
    vi.restoreAllMocks();

    const define = vi.fn();
    const listen = vi.fn();
    const serverFactory = vi.fn(() => ({ define, listen }));
    const createServer = vi.fn(() => ({ 
        tag: "http-server",
        on: vi.fn(),
    }));
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    vi.doMock("colyseus", () => ({
      Server: serverFactory,
    }));
    
    // We mock the dynamic import call
    vi.doMock("../../../games/wit-clash/index.js", () => ({
        WitClashGame: { name: "WitClash" }
    }));
    vi.doMock("node:http", () => ({
      createServer,
    }));
    vi.doMock("../src/rooms/GameRoom.js", () => ({
      GameRoom: class MockGameRoom {},
    }));

    await import("../src/index.js");
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(createServer).toHaveBeenCalled();
    expect(serverFactory).toHaveBeenCalledWith(
        expect.objectContaining({
            transport: expect.objectContaining({
                server: expect.objectContaining({ tag: "http-server" })
            })
        })
    );
    expect(define).toHaveBeenCalledWith("wit_clash", expect.any(Function));
    expect(listen).toHaveBeenCalledWith(2567);
    expect(info).toHaveBeenCalledWith("[GameServer] Listening on port 2567");

    info.mockRestore();
  });
});
