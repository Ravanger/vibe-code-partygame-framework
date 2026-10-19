import { describe, expect, it } from "vitest";
import { type Seed, seedFromNumber, sfc32 } from "../src/index.js";
import { ReplayHost } from "../src/replay/index.js";

describe("ReplayHost", () => {
  it("starts at the default clock with a deterministic unseeded RNG", () => {
    const host = new ReplayHost();
    expect(host.time).toBe(1_000_000);
    expect(host.seed).toEqual(seedFromNumber(0));
    expect(host.players()).toEqual([]);
    expect(host.now()).toBe(1_000_000);
  });

  it("expands a number seed and keeps a given Seed tuple", () => {
    const numeric = new ReplayHost(7);
    expect(numeric.seed).toEqual(seedFromNumber(7));
    expect(numeric.rng()).toBe(sfc32(seedFromNumber(7))());

    const seed: Seed = [1, 2, 3, 4];
    const tuple = new ReplayHost(seed);
    expect(tuple.seed).toEqual(seed);
  });

  it("seats the first player as host and applies per-seat overrides", () => {
    const host = new ReplayHost();
    const first = host.seat("p1");
    const second = host.seat("p2", { isReady: false });
    expect(first.role).toBe("host");
    expect(second.role).toBe("player");
    expect(second.isReady).toBe(false);
    expect(host.players()).toEqual([first, second]);
  });

  it("advances the clock firing due timers in order and keeps cleared ones pending-free", () => {
    const host = new ReplayHost();
    const fired: number[] = [];
    host.setTimeout(() => fired.push(1), 100);
    const early = host.setTimeout(() => fired.push(2), 50);
    host.advance(40);
    expect(fired).toEqual([]);
    host.clearTimeout(early);
    host.advance(100);
    expect(fired).toEqual([1]);

    // Two timers due at the same instant fire in insertion order.
    const tied: number[] = [];
    host.setTimeout(() => tied.push(1), 50);
    host.setTimeout(() => tied.push(2), 50);
    host.advance(50);
    expect(tied).toEqual([1, 2]);
  });

  it("activates ready seats and benches unready ones", () => {
    const host = new ReplayHost();
    const ready = host.seat("p1");
    const waiting = host.seat("p2", { isReady: false, isActive: false });
    host.activateWaitingPlayers();
    expect(ready.isActive).toBe(true);
    expect(waiting.isActive).toBe(false);
    host.benchUnreadyPlayers();
    expect(ready.isActive).toBe(true);
    expect(waiting.isActive).toBe(false);
  });

  it("removes a seat on kick and ignores missing ids", () => {
    const host = new ReplayHost();
    const first = host.seat("p1");
    host.kick("ghost");
    expect(host.players()).toEqual([first]);
    host.kick(first.id);
    expect(host.players()).toEqual([]);
  });

  it("drops client traffic without recording it", () => {
    const host = new ReplayHost();
    const seat = host.seat("p1");
    host.send(seat.id, "ACTION", {});
    host.broadcast("STATE", {});
    const view: object = {};
    host.showTo(seat.id, view);
    host.hideFrom(seat.id, view);
    host.publishOptions({});
    expect(host.players()).toEqual([seat]);
  });
});
