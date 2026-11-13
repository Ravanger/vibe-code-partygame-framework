import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { ScreenTitle } from "../../src/components/index.js";

describe("ScreenTitle", () => {
  it("renders a focusable heading with the title text", () => {
    render(ScreenTitle, { title: "Pick a card" });
    const heading = screen.getByRole("heading", { name: "Pick a card" });
    expect(heading).toHaveAttribute("tabindex", "-1");
  });

  it("shows the hint only when given", () => {
    const first = render(ScreenTitle, { title: "Tie-breaker!" });
    expect(first.container.querySelector(".hint")).toBeNull();
    first.unmount();

    render(ScreenTitle, { title: "Tie-breaker!", hint: "Tap the funnier answer" });
    expect(screen.getByText("Tap the funnier answer")).toBeInTheDocument();
  });
});
