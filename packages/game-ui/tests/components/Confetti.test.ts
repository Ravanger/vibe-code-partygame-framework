import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { Confetti } from "../../src/components/index.js";
import { expectNoViolations } from "../support/a11y.js";

function pieces(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(".confetti i")];
}

describe("Confetti", () => {
  it("renders the requested number of pieces inside the screen with palette colours", async () => {
    const { container } = render(Confetti, { count: 40 });
    expect(container.querySelector(".confetti")).toHaveAttribute("aria-hidden", "true");
    const rendered = pieces(container);
    expect(rendered).toHaveLength(40);
    for (const piece of rendered) {
      const left = Number.parseFloat(piece.style.left);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left).toBeLessThan(100);
      expect(Number.parseFloat(piece.style.animationDuration)).toBeGreaterThan(2);
      expect(piece.style.background).toMatch(/^var\(--/);
    }
    expect(new Set(rendered.map((piece) => piece.style.background)).size).toBe(5);
    await expectNoViolations(container, "Confetti");
  });

  it("is the same every time", () => {
    const first = render(Confetti, { count: 5 });
    const second = render(Confetti, { count: 5 });
    expect(pieces(second.container).map((p) => p.getAttribute("style"))).toEqual(
      pieces(first.container).map((p) => p.getAttribute("style")),
    );
    first.unmount();
    second.unmount();
  });

  it("hides the pieces and animates them only when motion is not reduced", () => {
    render(Confetti, { count: 3 });
    const sheet = [...document.querySelectorAll("style")]
      .map((s) => s.textContent ?? "")
      .filter((css) => css.includes(".confetti"))
      .join("\n")
      // drop comments: the source-map comment embeds the raw source, which names the animation
      .replace(/\/\*[\s\S]*?\*\//g, "");
    // everything outside the no-preference media block must be static
    const outside = sheet.replace(
      /@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{[\s\S]*?\}\s*\}/g,
      "",
    );
    expect(outside).not.toMatch(/animation/);
    // the keyframe name is scoped by Svelte, so allow a prefix before "fall"
    expect(sheet).toMatch(/animation:\s*[\w-]*fall/);
    expect(sheet).toMatch(/display:\s*none/);
  });
});
