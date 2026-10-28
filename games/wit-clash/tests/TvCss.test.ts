import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** The declaration block of the `main.tv` rule in app.css. */
function mainTvBlock(): string {
  // import.meta.url goes straight to fileURLToPath: under jsdom the global URL
  // resolver ignores file: bases, so new URL(rel, import.meta.url) is not usable here.
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../ui/app.css"), "utf8");
  const block = css.match(/main\.tv\s*{([^}]*)}/)?.[1];
  if (block === undefined) throw new Error("no main.tv rule in app.css");
  return block;
}

describe("TV typography contract (app.css)", () => {
  it("keeps the fs-1 family at or above 24px under main.tv", () => {
    // every fs-1 declaration on a TV screen is calc(var(--fs-1) * var(--scale, 1)) with --scale: 1.6,
    // so the single-point override must lift 0.875rem x 1.6 = 22.4px to at least 24px (0.9375rem x 1.6)
    expect(mainTvBlock()).toMatch(/--fs-1:\s*0\.9375rem/);
  });

  it("keeps the TV scale factor at 1.6", () => {
    expect(mainTvBlock()).toMatch(/--scale:\s*1\.6/);
  });
});
