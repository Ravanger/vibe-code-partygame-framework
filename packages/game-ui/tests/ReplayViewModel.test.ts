import { BaseGameState } from "@partygame/shared/schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ReplayTimer,
  ReplayViewModel,
  snapshotManager,
} from "../src/ReplayViewModel.svelte.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const bundle = (snapshots: unknown) =>
  JSON.stringify({ bundleVersion: 1, name: "T", gameVersion: "1.0.0", log: [], snapshots });

const threeSnapshots = [
  { seq: 1, phase: "Lobby", state: { phase: "Vote", canStart: false } },
  { seq: 5, phase: "Vote", state: { phase: "Reveal", canStart: true } },
  { seq: 9, phase: "Reveal", state: { phase: "Lobby", canStart: false } },
];

class FakeTimer implements ReplayTimer {
  intervals = 0;
  clears = 0;
  private callback: (() => void) | null = null;

  setInterval(callback: () => void, ms: number): unknown {
    this.intervals += 1;
    this.callback = callback;
    return ms;
  }

  clearInterval(_id: unknown): void {
    this.clears += 1;
    this.callback = null;
  }

  tick(): void {
    this.callback?.();
  }
}

describe("ReplayViewModel", () => {
  it("loading a valid bundle text exposes snapshots, index, current and phase", () => {
    const vm = new ReplayViewModel(bundle(threeSnapshots));
    expect(vm.error).toBeNull();
    expect(vm.snapshots.length).toBe(3);
    expect(vm.index).toBe(0);
    expect(vm.current).toEqual({ phase: "Vote", canStart: false });
    expect(vm.phase).toBe("Lobby");
  });

  it("next and previous walk the snapshots and clamp at both ends", () => {
    const vm = new ReplayViewModel(bundle(threeSnapshots));
    vm.next();
    expect(vm.index).toBe(1);
    expect(vm.phase).toBe("Vote");
    expect(vm.current).toEqual({ phase: "Reveal", canStart: true });
    vm.previous();
    expect(vm.index).toBe(0);
    vm.previous();
    expect(vm.index).toBe(0);
    vm.goTo(99);
    expect(vm.index).toBe(2);
    vm.next();
    expect(vm.index).toBe(2);
  });

  it("goTo clamps into the bundle's range", () => {
    const vm = new ReplayViewModel(bundle(threeSnapshots));
    vm.goTo(-5);
    expect(vm.index).toBe(0);
    vm.goTo(2);
    expect(vm.index).toBe(2);
  });

  it("invalid JSON sets an error and leaves no bundle", () => {
    const vm = new ReplayViewModel("{ not json");
    expect(vm.error).toBe("not valid JSON");
    expect(vm.snapshots.length).toBe(0);
    expect(vm.current).toBeNull();
    expect(vm.phase).toBe("");
    vm.next();
    vm.goTo(3);
    expect(vm.index).toBe(0);
  });

  it.each(["null", "42", "[1]"])("rejects a non-bundle JSON root (%s)", (text) => {
    const vm = new ReplayViewModel(text);
    expect(vm.error).toBe("not a replay bundle");
    expect(vm.snapshots.length).toBe(0);
  });

  it("rejects an unknown bundle version", () => {
    const vm = new ReplayViewModel(JSON.stringify({ bundleVersion: 2, snapshots: [] }));
    expect(vm.error).toBe("unsupported bundle version 2");
    expect(vm.snapshots.length).toBe(0);
  });

  it("rejects a bundle without snapshots", () => {
    const vm = new ReplayViewModel(JSON.stringify({ bundleVersion: 1 }));
    expect(vm.error).toBe("missing snapshots");
    expect(vm.snapshots.length).toBe(0);
  });

  it("rejects malformed snapshot entries", () => {
    const malformed = [
      null,
      "x",
      [1],
      {},
      { seq: "a", phase: "p", state: {} },
      { seq: 1, phase: 5, state: {} },
      { seq: 1, phase: "p", state: null },
      { seq: 1, phase: "p", state: [1] },
    ];
    for (const entry of malformed) {
      const vm = new ReplayViewModel(bundle([entry]));
      expect(vm.error).toBe("malformed snapshot");
      expect(vm.snapshots.length).toBe(0);
    }
  });

  it("loads a valid bundle with zero snapshots as an empty viewer", () => {
    const vm = new ReplayViewModel(bundle([]));
    expect(vm.error).toBeNull();
    expect(vm.snapshots.length).toBe(0);
    expect(vm.current).toBeNull();
    expect(vm.phase).toBe("");
  });

  it("play auto-advances on the injected timer and stops at the end", () => {
    const timer = new FakeTimer();
    const vm = new ReplayViewModel(bundle(threeSnapshots), { intervalMs: 250, timer });
    expect(vm.isPlaying).toBe(false);
    vm.play();
    expect(vm.isPlaying).toBe(true);
    expect(timer.intervals).toBe(1);
    timer.tick();
    expect(vm.index).toBe(1);
    expect(vm.isPlaying).toBe(true);
    timer.tick();
    expect(vm.index).toBe(2);
    expect(vm.isPlaying).toBe(false);
  });

  it("play is a no-op without advance room and keeps one interval on double play", () => {
    const timer = new FakeTimer();
    const single = new ReplayViewModel(
      bundle([{ seq: 1, phase: "Lobby", state: { phase: "Vote" } }]),
      { timer },
    );
    single.play();
    expect(single.isPlaying).toBe(false);
    expect(timer.intervals).toBe(0);
    const vm = new ReplayViewModel(bundle(threeSnapshots), { timer });
    vm.play();
    vm.play();
    expect(timer.intervals).toBe(1);
  });

  it("pause stops auto-advancing; pausing without play is a no-op", () => {
    const timer = new FakeTimer();
    const vm = new ReplayViewModel(bundle(threeSnapshots), { timer });
    vm.pause();
    expect(vm.isPlaying).toBe(false);
    expect(timer.clears).toBe(0);
    vm.play();
    vm.pause();
    expect(vm.isPlaying).toBe(false);
    expect(timer.clears).toBe(1);
    timer.tick();
    expect(vm.index).toBe(0);
  });

  it("uses the global timer when none is injected", () => {
    const vm = new ReplayViewModel(bundle(threeSnapshots), { intervalMs: 50 });
    vm.play();
    expect(vm.isPlaying).toBe(true);
    vi.advanceTimersByTime(50);
    expect(vm.index).toBe(1);
    expect(vm.isPlaying).toBe(true);
    vi.advanceTimersByTime(50);
    expect(vm.index).toBe(2);
    expect(vm.isPlaying).toBe(false);
  });
});

describe("snapshotManager", () => {
  const twoSnapshots = [
    { seq: 1, phase: "Lobby", state: { phase: "Vote" } },
    {
      seq: 5,
      phase: "Vote",
      state: { phase: "Reveal", canStart: true, players: { p1: { id: "p1", name: "Ada" } } },
    },
  ];

  it("fills a fresh state instance from the current snapshot as a spectator", () => {
    const vm = new ReplayViewModel(bundle(twoSnapshots));
    const manager = snapshotManager(vm, BaseGameState);
    expect(manager.isSpectator).toBe(true);
    expect(manager.state).toBeInstanceOf(BaseGameState);
    expect(manager.state.phase).toBe("Vote");
    expect(manager.state.players.size).toBe(0);

    vm.next();
    expect(manager.state).toBeInstanceOf(BaseGameState);
    expect(manager.state.phase).toBe("Reveal");
    expect(manager.state.canStart).toBe(true);
    expect(manager.state.players.get("p1")?.name).toBe("Ada");
  });

  it("returns a fresh instance on every access", () => {
    const vm = new ReplayViewModel(bundle(twoSnapshots));
    const manager = snapshotManager(vm, BaseGameState);
    expect(manager.state).not.toBe(manager.state);
  });

  it("returns an empty state when the bundle is invalid", () => {
    const vm = new ReplayViewModel("{ not json");
    const manager = snapshotManager(vm, BaseGameState);
    expect(manager.isSpectator).toBe(true);
    expect(manager.state).toBeInstanceOf(BaseGameState);
    expect(manager.state.phase).toBe("Lobby");
    expect(manager.state.players.size).toBe(0);
  });
});
