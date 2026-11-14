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

  it("keeps the title a paragraph by default", () => {
    const { container } = render(StatusPanel, { title: "Hold on", tone: "wait" });
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(container.querySelector("p.title")).toBeInTheDocument();
  });

  it("renders the title as a focusable heading when heading is set", async () => {
    const { container } = render(StatusPanel, {
      title: "Revealing...",
      tone: "wait",
      heading: true,
    });
    const heading = screen.getByRole("heading", { name: "Revealing..." });
    expect(heading.tagName).toBe("H2");
    expect(heading).toHaveClass("title");
    expect(heading).toHaveAttribute("tabindex", "-1");
    await expectNoViolations(container, "StatusPanel");
  });

  it("takes the done sticker text from the UiStrings table", () => {
    setStrings({ done: "Fertig" });
    const { container } = render(StatusPanel, { title: "T", tone: "done" });
    expect(container.querySelector(".sticker")?.textContent).toContain("Fertig");
  });
});
