import { BaseGameState } from "@partygame/shared/schema";
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import { addSeat, connectedClient, fakeFetch } from "../src/testing.js";
import { PressState } from "./fixtures/pressGame.js";
import { observe } from "./observe.svelte.js";

describe("connectedClient", () => {
  it("attaches a manager to a real state with this client seated", () => {
    const { manager, state, me } = connectedClient({ stateClass: PressState });
    expect(manager.status).toBe("connected");
    expect(manager.state).toBe(state);
    expect(me.id).toBe(manager.playerId);
    expect(state.players.get(manager.playerId)).toBe(me);
    expect(me.name).toBe("Me");
    expect(me.role).toBe("player");
    expect([me.isReady, me.isActive, me.isConnected]).toEqual([true, true, true]);
    expect(state.phase).toBe("Lobby");
    expect(manager.roomCode).toBe("ABCD");
  });

  it("honours seat, phase and setup", () => {
    const { manager, me } = connectedClient({
      stateClass: PressState,
      seat: { role: "host", name: "Ann", isActive: false },
      phase: "Press",
      setup: (s) => {
        s.presses = 2;
      },
    });
    expect(me.role).toBe("host");
    expect(me.name).toBe("Ann");
    expect(me.isActive).toBe(false);
    expect(manager.state?.phase).toBe("Press");
    expect(manager.state?.presses).toBe(2);
  });

  it("notifies the manager on patch()", () => {
    const c = connectedClient({ stateClass: PressState });
    const seen = observe(() => c.manager.state?.presses);
    c.state.presses = 5;
    c.patch();
    flushSync();
    expect(seen.values.at(-1)).toBe(5);
    seen.stop();
  });

  it("gives each client its own player id", () => {
    const a = connectedClient({ stateClass: PressState });
    const b = connectedClient({ stateClass: PressState });
    expect(a.manager.playerId).not.toBe(b.manager.playerId);
  });
});

describe("addSeat", () => {
  it("defaults to a ready, active, connected player named after the id", () => {
    const state = new BaseGameState();
    const seat = addSeat(state, "x1");
    expect(state.players.get("x1")).toBe(seat);
    expect(seat.name).toBe("x1");
    expect(seat.role).toBe("player");
    expect([seat.isActive, seat.isReady, seat.isConnected]).toEqual([true, true, true]);
  });

  it("applies every override", () => {
    const state = new BaseGameState();
    const seat = addSeat(state, "x1", {
      name: "Zed",
      role: "host",
      isActive: false,
      isReady: false,
      isConnected: false,
    });
    expect(seat.name).toBe("Zed");
    expect(seat.role).toBe("host");
    expect([seat.isActive, seat.isReady, seat.isConnected]).toEqual([false, false, false]);
  });
});

describe("fakeFetch", () => {
  it("records string, URL and Request inputs", async () => {
    const stub = fakeFetch({});
    await stub.fetch("http://a/1");
    await stub.fetch(new URL("http://a/2"));
    await stub.fetch(new Request("http://a/3"));
    expect(stub.urls).toEqual(["http://a/1", "http://a/2", "http://a/3"]);
  });

  it("answers an object as JSON", async () => {
    const response = await fakeFetch({ roomId: "r" }).fetch("http://a");
    expect(await response.json()).toEqual({ roomId: "r" });
  });

  it("rejects with an Error or a string", async () => {
    const failure = new Error("down");
    await expect(fakeFetch(failure).fetch("http://a")).rejects.toBe(failure);
    await expect(fakeFetch("nope").fetch("http://a")).rejects.toBe("nope");
  });
});
