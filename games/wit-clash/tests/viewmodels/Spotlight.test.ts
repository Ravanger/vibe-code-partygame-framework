import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Spotlight } from "../../ui/viewmodels/Spotlight.svelte.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Spotlight", () => {
  it("cycles through the panels every period and wraps around", () => {
    const spotlight = new Spotlight(() => 2, 1000);
    expect(spotlight.current).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(spotlight.current).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(spotlight.current).toBe(0);
    spotlight.destroy();
  });

  it("stays on the first panel while there is only one", () => {
    let count = 2;
    const spotlight = new Spotlight(() => count, 1000);
    expect(spotlight.isActive).toBe(true);
    vi.advanceTimersByTime(1000);
    count = 1;
    expect(spotlight.isActive).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(spotlight.current).toBe(0);
    spotlight.destroy();
  });

  it("stops cycling once destroyed", () => {
    const spotlight = new Spotlight(() => 2, 1000);
    spotlight.destroy();
    vi.advanceTimersByTime(3000);
    expect(spotlight.current).toBe(0);
  });
});
