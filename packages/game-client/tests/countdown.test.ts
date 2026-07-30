import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Countdown } from "../src/countdown.svelte.js";

describe("Countdown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the correct seconds at the start", () => {
    vi.setSystemTime(1_000_000);
    const countdown = new Countdown(
      () => 1_060_000,
      () => 1_000_000,
    );
    expect(countdown.secondsLeft).toBe(60);
    countdown.destroy();
  });

  // The other tests freeze the clock, so they can't catch a mismatch between the two
  // construction-time Date.now() reads. getServerNowFn runs between them, so advancing
  // the clock here reproduces a real wall clock ticking over mid-construction.
  it("does not overshoot by a second when the clock advances during construction", () => {
    vi.setSystemTime(1_000_000);
    const countdown = new Countdown(
      () => 1_060_000,
      () => {
        vi.setSystemTime(Date.now() + 1);
        return 1_000_000;
      },
    );
    expect(countdown.secondsLeft).toBe(60);
    countdown.destroy();
  });

  it("ticks down as time passes", () => {
    vi.setSystemTime(1_000_000);
    const countdown = new Countdown(
      () => 1_060_000,
      () => 1_000_000,
    );
    vi.advanceTimersByTime(5_000);
    expect(countdown.secondsLeft).toBe(55);
    countdown.destroy();
  });

  it("never goes below zero", () => {
    vi.setSystemTime(1_000_000);
    const countdown = new Countdown(
      () => 1_030_000,
      () => 1_000_000,
    );
    vi.advanceTimersByTime(100_000);
    expect(countdown.secondsLeft).toBe(0);
    countdown.destroy();
  });

  it("reports zero when no timer is set", () => {
    const countdown = new Countdown(
      () => 0,
      () => 0,
    );
    expect(countdown.secondsLeft).toBe(0);
    countdown.destroy();
  });

  it("corrects for a skewed client clock", () => {
    vi.setSystemTime(1_000_000);
    const countdown = new Countdown(
      () => 2_030_000,
      () => 2_000_000,
    );
    expect(countdown.secondsLeft).toBe(30);
    countdown.destroy();
  });

  it("flags the last ten seconds as urgent", () => {
    vi.setSystemTime(1_000_000);
    const countdown = new Countdown(
      () => 1_000_009_000,
      () => 1_000_000_000,
    );
    expect(countdown.isUrgent).toBe(true);
    countdown.destroy();
  });

  it("is not urgent when more than 10 seconds remain", () => {
    vi.setSystemTime(1_000_000);
    const countdown = new Countdown(
      () => 1_000_015_000,
      () => 1_000_000_000,
    );
    expect(countdown.isUrgent).toBe(false);
    countdown.destroy();
  });

  it("clears its interval on destroy", () => {
    const countdown = new Countdown(
      () => 0,
      () => 0,
    );
    countdown.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("is expired when serverNow >= phaseEndsAt", () => {
    vi.setSystemTime(1_000_000);
    const countdown = new Countdown(
      () => 1_000_000,
      () => 1_000_000,
    );
    expect(countdown.isExpired).toBe(true);
    countdown.destroy();
  });
});
