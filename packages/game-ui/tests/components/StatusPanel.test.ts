import { render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import { StatusPanel } from "../../src/components/index.js";
import { setStrings } from "../../src/strings.js";
import { expectNoViolations } from "../support/a11y.js";

afterEach(() => setStrings({}));

describe("StatusPanel", () => {
  it("shows a waiting message with breathing dots", async () => {
    const { container } = render(StatusPanel, { title: "Hold on", tone: "wait" });
    expect(screen.getByText("Hold on")).toBeInTheDocument();
    expect(container.querySelector(".dots")).toBeInTheDocument();
    expect(container.querySelector(".detail")).not.toBeInTheDocument();
    await expectNoViolations(container, "StatusPanel");
  });

  it("shows a detail line for the other tones, without dots", async () => {
    const { container } = render(StatusPanel, { title: "Done", detail: "All set", tone: "done" });
    expect(screen.getByText("All set")).toBeInTheDocument();
    expect(container.querySelector(".dots")).not.toBeInTheDocument();
    expect(screen.getByText(/done/i, { selector: ".sticker" })).toBeInTheDocument();
    expect(container.querySelector(".status-panel")).toHaveClass("tone-done");
    const info = render(StatusPanel, { title: "Tip", tone: "info" });
    expect(info.container.querySelector(".status-panel")).toHaveClass("tone-info");
    expect(info.container.querySelector(".sticker")).not.toBeInTheDocument();
    await expectNoViolations(container, "StatusPanel");
    await expectNoViolations(info.container, "StatusPanel");
  });

  it("takes the done sticker text from the UiStrings table", () => {
    setStrings({ done: "Fertig" });
    const { container } = render(StatusPanel, { title: "T", tone: "done" });
    expect(container.querySelector(".sticker")?.textContent).toContain("Fertig");
  });

  it("renders a focusable semantic heading when heading is enabled", async () => {
    const { container } = render(StatusPanel, {
      title: "Revealing...",
      tone: "wait",
      heading: true,
    });
    const heading = screen.getByRole("heading", { level: 2, name: "Revealing..." });
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(container.querySelector(".dots")).toBeInTheDocument();
    await expectNoViolations(container, "StatusPanel heading");
  });
});
