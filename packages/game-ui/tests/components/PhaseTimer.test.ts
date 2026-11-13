import { connectedClient } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { render, screen } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhaseTimer } from "../../src/components/index.js";
import { PhaseClock } from "../../src/PhaseClock.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

describe("PhaseTimer", () => {
  const LENGTH = 92;
  const START = 6;

  function tip(container: HTMLElement): number {
    return Number(container.querySelector(".stick")?.getAttribute("x2"));
  }

  it("renders the clock's seconds, fraction and announcement, and updates as the countdown ticks", () => {
    const c = connectedClient({ stateClass: BaseGameState });
    c.state.serverNow = 1_000_000;
    c.state.phaseEndsAt = 1_000_000 + 30_000;
    const { container } = render(PhaseTimer, { clock: new PhaseClock(c.manager, () => 90) });

    expect(screen.getByText("30")).toBeInTheDocument();
    expect(tip(container)).toBeCloseTo(START + LENGTH / 3);
    expect(container.querySelector("[aria-live='polite']")?.textContent).toBe(
      "30 seconds remaining",
    );

    vi.advanceTimersByTime(10_000);
    flushSync();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(tip(container)).toBeCloseTo(START + (LENGTH * 2) / 9);
    expect(container.querySelector("[aria-live='polite']")?.textContent).toBe("");
  });
});
