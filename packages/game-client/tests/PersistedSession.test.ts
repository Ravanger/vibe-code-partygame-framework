import { afterEach, describe, expect, it, vi } from "vitest";
import { PersistedSession } from "../src/PersistedSession.js";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("PersistedSession", () => {
  it("creates a player id once and keeps it across instances", () => {
    const first = new PersistedSession("g").playerId;
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(new PersistedSession("g").playerId).toBe(first);
    expect(localStorage.getItem("g.playerId")).toBe(first);
  });

  it("keeps prefixes apart", () => {
    expect(new PersistedSession("a").playerId).not.toBe(new PersistedSession("b").playerId);
  });

  it("stores the room code locally and the token per tab, and clears both", () => {
    const session = new PersistedSession("g");
    const id = session.playerId;
    expect(session.token).toBeUndefined();
    expect(session.roomCode).toBeUndefined();
    session.token = "room:tok";
    session.roomCode = "ABCD";
    expect(sessionStorage.getItem("g.reconnectionToken")).toBe("room:tok");
    expect(localStorage.getItem("g.roomCode")).toBe("ABCD");
    expect(new PersistedSession("g").token).toBe("room:tok");
    session.clear();
    expect(session.token).toBeUndefined();
    expect(session.roomCode).toBeUndefined();
    expect(localStorage.getItem("g.playerId")).toBe(id);
  });

  it("remembers a spectator join until cleared", () => {
    const session = new PersistedSession("g");
    expect(session.spectator).toBe(false);
    session.spectator = true;
    expect(new PersistedSession("g").spectator).toBe(true);
    session.spectator = false;
    expect(session.spectator).toBe(false);
    session.spectator = true;
    session.clear();
    expect(session.spectator).toBe(false);
  });

  it("still works in memory when storage throws", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const session = new PersistedSession("g");
    const id = session.playerId;
    expect(session.playerId).toBe(id);
    expect(session.roomCode).toBeUndefined();
    session.roomCode = "ABCD";
    expect(() => session.clear()).not.toThrow();
  });
});
