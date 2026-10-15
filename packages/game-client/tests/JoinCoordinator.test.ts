import { Client } from "@colyseus/sdk";
import { BaseGameState } from "@partygame/shared/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameConnectionManager } from "../src/GameConnectionManager.svelte.js";
import { JoinCoordinator } from "../src/JoinCoordinator.js";
import { fakeFetch, StubRoom } from "../src/testing.js";

let counter = 0;
const newManager = () =>
  new GameConnectionManager({
    endpoint: "ws://localhost:2567",
    roomName: "stub",
    storagePrefix: `join${++counter}`,
  });

const settle = () => new Promise((resolve) => setTimeout(resolve));

function gated<T>(): { promise: Promise<T>; release: (value: T) => void } {
  let release: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => (release = resolve));
  return { promise, release };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("JoinCoordinator", () => {
  it("the same key twice shares one run and calls open once", async () => {
    const c = new JoinCoordinator();
    let opens = 0;
    const gate = gated<void>();
    const first = c.run("a", async () => {
      ++opens;
      await gate.promise;
    });
    const second = c.run("a", async () => {
      ++opens;
    });
    gate.release();
    await Promise.all([first, second]);
    expect(opens).toBe(1);
  });

  it("different keys run separately", async () => {
    const c = new JoinCoordinator();
    const seen: string[] = [];
    await c.run("a", async () => {
      seen.push("a");
    });
    await c.run("b", async () => {
      seen.push("b");
    });
    expect(seen).toEqual(["a", "b"]);
  });

  it("cancel rejects the in-flight run with the cancelled error", async () => {
    const c = new JoinCoordinator();
    const gate = gated<void>();
    const running = c.run("a", async () => {
      await gate.promise;
    });
    c.cancel();
    gate.release();
    await expect(running).rejects.toThrow("Connection cancelled");
  });

  it("a run started after cancel succeeds", async () => {
    const c = new JoinCoordinator();
    const gate = gated<void>();
    const first = c.run("a", async () => {
      await gate.promise;
    });
    c.cancel();
    gate.release();
    await expect(first).rejects.toThrow("Connection cancelled");
    let ran = false;
    await c.run("a", async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  it("clears the pending entry after success and after failure", async () => {
    const c = new JoinCoordinator();
    let opens = 0;
    await c.run("a", async () => {
      ++opens;
    });
    await expect(
      c.run("a", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await c.run("a", async () => {
      ++opens;
    });
    expect(opens).toBe(2);
  });

  it("starting a new run supersedes the in-flight one", async () => {
    const c = new JoinCoordinator();
    const gate = gated<void>();
    const first = c.run("a", async () => {
      await gate.promise;
    });
    const second = c.run("b", async () => {});
    gate.release();
    await expect(first).rejects.toThrow("Connection cancelled");
    await expect(second).resolves.toBeUndefined();
  });
});

describe("the manager's cancel race", () => {
  it("a join cancelled by leave() leaves the opened room and ends disconnected", async () => {
    const manager = newManager();
    const state = new BaseGameState();
    state.roomCode = "";
    const room = new StubRoom(state);
    const leaveSpy = vi.spyOn(room, "leave").mockResolvedValue(1000);
    vi.stubGlobal("fetch", fakeFetch({ roomId: room.roomId }).fetch);
    vi.spyOn(Client.prototype, "joinById").mockResolvedValue(room as never);
    const joining = manager.join("ABCD");
    await settle();
    expect(manager.status).toBe("connecting");
    await manager.leave();
    state.roomCode = "ABCD";
    room.patch();
    await expect(joining).rejects.toThrow("Connection cancelled");
    expect(leaveSpy).toHaveBeenCalledTimes(1);
    expect(manager.status).toBe("disconnected");
  });

  it("a join cancelled while closing the previous room gives up before opening", async () => {
    const manager = newManager();
    const state = new BaseGameState();
    state.roomCode = "ABCD";
    const first = new StubRoom(state);
    manager.attach(first);
    const gate = gated<number>();
    vi.spyOn(first, "leave").mockImplementation(() => gate.promise);
    vi.stubGlobal("fetch", fakeFetch({ roomId: "room-2" }).fetch);
    const second = new StubRoom(new BaseGameState());
    const joinSpy = vi.spyOn(Client.prototype, "joinById").mockResolvedValue(second as never);
    const joining = manager.join("WXYZ");
    await settle();
    const leaving = manager.leave();
    gate.release(1000);
    await leaving;
    await expect(joining).rejects.toThrow("Connection cancelled");
    expect(joinSpy).not.toHaveBeenCalled();
    expect(manager.status).toBe("disconnected");
  });
});
