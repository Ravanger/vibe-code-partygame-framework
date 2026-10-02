import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhaseClock } from "../../ui/viewmodels/PhaseClock.js";
import { connectedClient } from "../helpers/client.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

describe("PhaseClock", () => {
  function clock(seconds: number, options: string | undefined = undefined) {
    const c = connectedClient({}, "Prompting");
    if (options !== undefined) c.state.options = options;
    c.state.serverNow = 1_000_000;
    c.state.phaseEndsAt = 1_000_000 + seconds * 1000;
    return { c, clock: new PhaseClock(c.manager, "promptSeconds") };
  }

  it("counts down and goes urgent in the last ten seconds", () => {
    const calm = clock(30);
    expect(calm.clock.secondsLeft).toBe(30);
    expect(calm.clock.isUrgent).toBe(false);
    calm.clock.destroy();
    const urgent = clock(9);
    expect(urgent.clock.isUrgent).toBe(true);
    urgent.clock.destroy();
  });

  it("announces only at 30, 10 and 5 seconds", () => {
    const at30 = clock(30);
    expect(at30.clock.announcement).toBe("30 seconds remaining");
    at30.clock.destroy();
    const at20 = clock(20);
    expect(at20.clock.announcement).toBe("");
    at20.clock.destroy();
  });

  it("reads the phase length from the room options, falling back to the defaults", () => {
    const set = clock(30, JSON.stringify({ promptSeconds: 45 }));
    expect(set.clock.totalSeconds).toBe(45);
    set.clock.destroy();
    const unset = clock(30, "{}");
    expect(unset.clock.totalSeconds).toBe(90);
    unset.clock.destroy();
    const broken = clock(30, "not json");
    expect(broken.clock.totalSeconds).toBe(90);
    broken.clock.destroy();
    const invalid = clock(30, JSON.stringify({ promptSeconds: 1 }));
    expect(invalid.clock.totalSeconds).toBe(90);
    invalid.clock.destroy();
  });

  it("falls back to the defaults without a room", () => {
    const { c, clock: subject } = clock(30);
    c.manager.dispose();
    expect(subject.totalSeconds).toBe(90);
    subject.destroy();
  });
});
