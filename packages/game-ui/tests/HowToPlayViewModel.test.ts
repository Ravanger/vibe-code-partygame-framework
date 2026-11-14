import { connectedClient } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { describe, expect, it, vi } from "vitest";
import { HowToPlayViewModel } from "../src/HowToPlayViewModel.svelte.js";

/** A storage that records writes; `fail` makes every access throw (a blocked or private window). */
function fakeStorage(fail = false) {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string): string | null => {
      if (fail) throw new Error("storage is blocked");
      return values.get(key) ?? null;
    },
    setItem: (key: string, value: string): void => {
      if (fail) throw new Error("storage is blocked");
      values.set(key, value);
    },
  };
}

/** A timer that records the running intervals so a test can fire them. */
function fakeTimer() {
  const running = new Map<unknown, { callback: () => void; ms: number }>();
  let nextId = 0;
  return {
    running,
    setInterval(callback: () => void, ms: number): unknown {
      const id = ++nextId;
      running.set(id, { callback, ms });
      return id;
    },
    clearInterval(id: unknown): void {
      running.delete(id);
    },
  };
}

const fireAll = (timer: ReturnType<typeof fakeTimer>): void => {
  for (const interval of [...timer.running.values()]) interval.callback();
};

const manager = () => connectedClient({ stateClass: BaseGameState }).manager;

const options = (extra: Record<string, unknown> = {}) => ({
  storage: fakeStorage(),
  storagePrefix: "test-game",
  ...extra,
});

describe("HowToPlayViewModel", () => {
  it("opens and closes the sheet, and does nothing without steps", () => {
    const vm = new HowToPlayViewModel(manager(), options(), () => 3);
    expect(vm.open).toBe(false);
    vm.openSheet();
    expect(vm.open).toBe(true);
    vm.closeSheet();
    expect(vm.open).toBe(false);

    const empty = new HowToPlayViewModel(manager(), options(), () => 0);
    empty.openSheet();
    expect(empty.open).toBe(false);
  });

  it("treats a missing step count as zero steps", () => {
    const vm = new HowToPlayViewModel(manager(), options());
    vm.openSheet();
    expect(vm.open).toBe(false);
    vm.next();
    vm.previous();
    vm.goTo(1);
    expect(vm.stepIndex).toBe(0);
    vm.startCarousel();
    expect(vm.carouselRunning).toBe(false);
  });

  it("auto-opens once per browser, flagging the sheet under the storage prefix", () => {
    const storage = fakeStorage();
    const first = new HowToPlayViewModel(manager(), options({ storage }), () => 3);
    first.autoOpen();
    expect(first.open).toBe(true);
    expect(storage.values.get("test-game.howToPlaySeen")).toBe("1");

    const second = new HowToPlayViewModel(manager(), options({ storage }), () => 3);
    expect(second.open).toBe(false);
    second.autoOpen();
    expect(second.open).toBe(false);
  });

  it("marks the sheet seen when the player opens it by hand", () => {
    const storage = fakeStorage();
    const vm = new HowToPlayViewModel(manager(), options({ storage }), () => 3);
    vm.openSheet();
    expect(storage.values.get("test-game.howToPlaySeen")).toBe("1");

    const later = new HowToPlayViewModel(manager(), options({ storage }), () => 3);
    later.autoOpen();
    expect(later.open).toBe(false);
  });

  it("never throws with a throwing or blocked storage and opens once per page load", () => {
    const broken = fakeStorage(true);
    const first = new HowToPlayViewModel(manager(), options({ storage: broken }), () => 3);
    expect(() => first.autoOpen()).not.toThrow();
    expect(first.open).toBe(true);

    // a fresh page load against the same blocked storage opens again
    const second = new HowToPlayViewModel(manager(), options({ storage: broken }), () => 3);
    expect(() => second.autoOpen()).not.toThrow();
    expect(second.open).toBe(true);
  });

  it("walks the steps with wrap-around and jumps with goTo", () => {
    const vm = new HowToPlayViewModel(manager(), options(), () => 3);
    expect(vm.stepIndex).toBe(0);
    vm.next();
    expect(vm.stepIndex).toBe(1);
    vm.goTo(5);
    expect(vm.stepIndex).toBe(2);
    vm.next();
    expect(vm.stepIndex).toBe(0);
    vm.previous();
    expect(vm.stepIndex).toBe(2);
    vm.goTo(-1);
    expect(vm.stepIndex).toBe(2);

    const empty = new HowToPlayViewModel(manager(), options(), () => 0);
    empty.next();
    empty.previous();
    empty.goTo(1);
    expect(empty.stepIndex).toBe(0);
  });

  it("auto-advances the carousel every intervalMs, wrapping around", () => {
    const timer = fakeTimer();
    const vm = new HowToPlayViewModel(manager(), options({ timer }), () => 3);
    vm.startCarousel();
    expect(vm.carouselRunning).toBe(true);
    expect([...timer.running.values()].map((i) => i.ms)).toEqual([8000]);

    fireAll(timer);
    expect(vm.stepIndex).toBe(1);
    fireAll(timer);
    expect(vm.stepIndex).toBe(2);
    fireAll(timer);
    expect(vm.stepIndex).toBe(0);
  });

  it("uses a custom carousel interval", () => {
    const timer = fakeTimer();
    const vm = new HowToPlayViewModel(manager(), options({ timer, intervalMs: 2500 }), () => 3);
    vm.startCarousel();
    expect([...timer.running.values()].map((i) => i.ms)).toEqual([2500]);
  });

  it("stops the carousel for good on user input and pauses without the flag", () => {
    const timer = fakeTimer();
    const vm = new HowToPlayViewModel(manager(), options({ timer }), () => 3);
    vm.startCarousel();
    vm.stopCarousel();
    expect(vm.carouselRunning).toBe(false);
    expect(timer.running.size).toBe(0);
    vm.startCarousel(); // user input stopped it for good
    expect(vm.carouselRunning).toBe(false);

    const paused = new HowToPlayViewModel(manager(), options({ timer }), () => 3);
    paused.startCarousel();
    paused.pauseCarousel();
    expect(paused.carouselRunning).toBe(false);
    paused.startCarousel(); // a pause lifts again
    expect(paused.carouselRunning).toBe(true);
  });

  it("does not run the carousel with a single step", () => {
    const timer = fakeTimer();
    const vm = new HowToPlayViewModel(manager(), options({ timer }), () => 1);
    vm.startCarousel();
    expect(vm.carouselRunning).toBe(false);
  });

  it("uses the global timer when none is injected", () => {
    vi.useFakeTimers();
    try {
      const vm = new HowToPlayViewModel(manager(), options(), () => 3);
      vm.startCarousel();
      expect(vm.carouselRunning).toBe(true);
      vi.advanceTimersByTime(8000);
      expect(vm.stepIndex).toBe(1);
      vm.stopCarousel();
      expect(vm.carouselRunning).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports the seatless viewer", () => {
    const c = connectedClient({ stateClass: BaseGameState });
    const vm = new HowToPlayViewModel(c.manager, options(), () => 3);
    expect(vm.isSpectator).toBe(false);
    c.state.players.delete(c.manager.playerId);
    expect(vm.isSpectator).toBe(true);
  });
});
