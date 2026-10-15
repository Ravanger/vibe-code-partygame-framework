import { connectedClient } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhaseClock } from "../src/PhaseClock.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

describe("PhaseClock", () => {
  function clock(seconds: number, total = 90) {
    const c = connectedClient({ stateClass: BaseGameState });
    c.state.serverNow = 1_000_000;
    c.state.phaseEndsAt = 1_000_000 + seconds * 1000;
    return new PhaseClock(c.manager, () => total);
  }

  it("counts down and goes urgent in the last ten seconds", () => {
    const calm = clock(30);
    expect(calm.secondsLeft).toBe(30);
    expect(calm.isUrgent).toBe(false);
    calm.destroy();
    const urgent = clock(9);
    expect(urgent.isUrgent).toBe(true);
    urgent.destroy();
  });

  it("announces only at 30, 10 and 5 seconds by default", () => {
    const at30 = clock(30);
    expect(at30.announcement).toBe("30 seconds remaining");
    at30.destroy();
    const at29 = clock(29);
    expect(at29.announcement).toBe("");
    at29.destroy();
    const at10 = clock(10);
    expect(at10.announcement).toBe("10 seconds remaining");
    at10.destroy();
    const at5 = clock(5);
    expect(at5.announcement).toBe("5 seconds remaining");
    at5.destroy();
  });

  it("reads the phase length from the supplied getter on every read", () => {
    let total = 90;
    const c = connectedClient({ stateClass: BaseGameState });
    c.state.serverNow = 1_000_000;
    c.state.phaseEndsAt = 1_000_000 + 30_000;
    const subject = new PhaseClock(c.manager, () => total);
    expect(subject.totalSeconds).toBe(90);
    total = 45;
    expect(subject.totalSeconds).toBe(45);
    subject.destroy();
  });

  it("announces at custom thresholds", () => {
    const c = connectedClient({ stateClass: BaseGameState });
    c.state.serverNow = 1_000_000;
    c.state.phaseEndsAt = 1_000_000 + 7 * 1000;
    const subject = new PhaseClock(c.manager, () => 30, [7]);
    expect(subject.announcement).toBe("7 seconds remaining");
    subject.destroy();
  });
});
