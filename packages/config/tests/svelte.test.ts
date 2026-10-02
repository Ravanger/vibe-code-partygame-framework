import { describe, expect, it } from "vitest";
import { svelteConfig } from "../src/svelte.js";

describe("svelteConfig", () => {
  it("enables runes", () => {
    expect(svelteConfig.compilerOptions.runes).toBe(true);
  });

  it("preprocesses with one preprocessor", () => {
    expect(svelteConfig.preprocess).toHaveLength(1);
  });
});
