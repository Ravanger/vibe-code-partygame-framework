import { describe, expect, it } from "vitest";
import { mulberry32 } from "../../src/index.js";
import { FakeHost } from "../../src/testing/index.js";

describe("FakeHost", () => {
  it("seats the first player as host and the rest as players, ready and active", () => {
    const host = new FakeHost();
    expect(host.seat("a")).toMatchObject({
      role: "host",
      isConnected: true,
      isReady: true,
      isActive: true,
    });
    expect(host.seat("b", { isActive: false })).toMatchObject({ role: "player", isActive: false });
    expect(host.players().map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("runs timers in time order, then in creation order, and clears them", () => {
    const host = new FakeHost();
    const order: string[] = [];
    host.setTimeout(() => order.push("late"), 20);
    host.setTimeout(() => order.push("first"), 10);
    host.setTimeout(() => order.push("second"), 10);
    const cancelled = host.setTimeout(() => order.push("never"), 5);
    host.clearTimeout(cancelled);
    expect(host.pendingTimers).toBe(3);
    const start = host.now();
    host.advance(15);
    expect(order).toEqual(["first", "second"]);
    expect(host.now()).toBe(start + 15);
    host.advance(10);
    expect(order).toEqual(["first", "second", "late"]);
    expect(host.pendingTimers).toBe(0);
  });

  it("records messages, view changes, kicks, activations and published options", () => {
    const host = new FakeHost();
    host.seat("a");
    host.seat("b", { isActive: false });
    const ref = {};
    host.send("a", "ERROR", { code: "X" });
    host.send("a", "OTHER", 1);
    host.broadcast("ALL", 2);
    host.showTo("a", ref);
    host.hideFrom("a", ref);
    host.publishOptions({ n: 1 });
    host.activateWaitingPlayers();
    host.kick("b");
    host.kick("nobody");
    expect(host.errorsTo("a")).toEqual([{ code: "X" }]);
    expect(host.errorsTo("b")).toEqual([]);
    expect(host.broadcasts).toEqual([{ type: "ALL", payload: 2 }]);
    expect(host.views.map((v) => v.op)).toEqual(["show", "hide"]);
    expect(host.published).toEqual([{ n: 1 }]);
    expect(host.activations).toBe(1);
    expect(host.kicked).toEqual(["b", "nobody"]);
    expect(host.players().map((p) => p.id)).toEqual(["a"]);
    expect(host.rng()).toBe(0.5);
  });

  it("draws rng from mulberry32 when constructed with a seed", () => {
    const host = new FakeHost(42);
    expect(host.seed).toBe(42);
    const expected = mulberry32(42);
    for (let i = 0; i < 10; ++i) expect(host.rng()).toBe(expected());
  });

  it("differs across seeds, and stays the constant 0.5 unseeded", () => {
    expect(new FakeHost(1).rng()).not.toBe(new FakeHost(2).rng());
    expect(new FakeHost().seed).toBe(0);
    expect(new FakeHost().rng()).toBe(0.5);
  });

  it("benches only unready seats", () => {
    const host = new FakeHost();
    const ready = host.seat("a");
    const unnamed = host.seat("b", { isReady: false });
    host.benchUnreadyPlayers();
    expect([ready.isActive, unnamed.isActive]).toEqual([true, false]);
  });

  it("activates only ready seats", () => {
    const host = new FakeHost();
    const ready = host.seat("a", { isActive: false });
    const unnamed = host.seat("b", { isActive: false, isReady: false });
    host.activateWaitingPlayers();
    expect([ready.isActive, unnamed.isActive]).toEqual([true, false]);
  });
});
