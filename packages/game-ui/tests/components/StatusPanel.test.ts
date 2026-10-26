import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { StatusPanel } from "../../src/components/index.js";
import { expectNoViolations } from "../support/a11y.js";

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
  });
});
