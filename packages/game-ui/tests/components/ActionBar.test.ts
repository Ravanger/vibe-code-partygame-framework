import { render, screen, within } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import { ActionBar } from "../../src/components/index.js";
import { expectNoViolations } from "../support/a11y.js";

describe("ActionBar", () => {
  it("holds the primary action", async () => {
    const children = createRawSnippet(() => ({
      render: () => "<button type='button'>Go</button>",
    }));
    const { container } = render(ActionBar, { children });
    expect(container.querySelector(".action-bar")).toContainElement(
      screen.getByRole("button", { name: "Go" }),
    );
    await expectNoViolations(container, "ActionBar");
  });

  it("renders its slotted actions in order inside the bar", () => {
    const children = createRawSnippet(() => ({
      // one root: a raw snippet only keeps its first top-level node
      render: () =>
        "<div><button type='button'>One</button><button type='button'>Two</button></div>",
    }));
    const { container } = render(ActionBar, { children });
    const bar = container.querySelector<HTMLElement>(".action-bar");
    expect(bar).not.toBeNull();
    const names = within(bar as HTMLElement)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(names).toEqual(["One", "Two"]);
  });
});
