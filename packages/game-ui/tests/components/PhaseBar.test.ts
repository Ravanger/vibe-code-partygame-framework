import { connectedClient } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { PhaseBar } from "../../src/components/index.js";
import { PhaseClock } from "../../src/PhaseClock.js";

describe("PhaseBar", () => {
  function bar(seconds: number, total: number) {
    const c = connectedClient({ stateClass: BaseGameState });
    c.state.serverNow = 1_000_000;
    c.state.phaseEndsAt = 1_000_000 + seconds * 1000;
    return render(PhaseBar, { clock: new PhaseClock(c.manager, () => total) });
  }

  const width = (container: HTMLElement) =>
    container.querySelector<HTMLElement>(".drain")?.style.width;

  it("says when the next phase starts and drains in proportion", () => {
    const { container } = bar(3, 6);
    expect(screen.getByText("Next up in 3s")).toBeInTheDocument();
    expect(width(container)).toBe("50%");
  });

  it("stays on the track, and is empty without a total", () => {
    const over = bar(9, 6);
    expect(width(over.container)).toBe("100%");
    const none = bar(2, 0);
    expect(width(none.container)).toBe("0%");
  });
});
