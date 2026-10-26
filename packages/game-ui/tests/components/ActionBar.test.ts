import { render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
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

  it("keeps its actions in tab order", async () => {
    const children = createRawSnippet(() => ({
      // one root: a raw snippet only keeps its first top-level node
      render: () =>
        "<div><button type='button'>One</button><button type='button'>Two</button></div>",
    }));
    render(ActionBar, { children });
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("button", { name: "One" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Two" })).toHaveFocus();
  });
});
