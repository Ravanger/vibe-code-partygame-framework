import { render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import { ActionBar } from "../../src/components/index.js";

describe("ActionBar", () => {
  it("holds the primary action", () => {
    const children = createRawSnippet(() => ({
      render: () => "<button type='button'>Go</button>",
    }));
    const { container } = render(ActionBar, { children });
    expect(container.querySelector(".action-bar")).toContainElement(
      screen.getByRole("button", { name: "Go" }),
    );
  });
});
