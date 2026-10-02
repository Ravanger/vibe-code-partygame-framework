import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import NextUpBar from "../../ui/components/NextUpBar.svelte";

describe("NextUpBar", () => {
  const width = (container: HTMLElement) =>
    container.querySelector<HTMLElement>(".drain")?.style.width;

  it("says when the next matchup starts and drains in proportion", () => {
    const { container } = render(NextUpBar, { seconds: 3, total: 6 });
    expect(screen.getByText("Next up in 3s")).toBeInTheDocument();
    expect(width(container)).toBe("50%");
  });

  it("stays on the track, and is empty without a total", () => {
    const over = render(NextUpBar, { seconds: 9, total: 6 });
    expect(width(over.container)).toBe("100%");
    const under = render(NextUpBar, { seconds: -1, total: 6 });
    expect(width(under.container)).toBe("0%");
    const none = render(NextUpBar, { seconds: 2, total: 0 });
    expect(width(none.container)).toBe("0%");
  });
});
