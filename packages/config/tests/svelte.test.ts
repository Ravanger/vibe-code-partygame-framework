import { compile } from "svelte/compiler";
import { describe, expect, it } from "vitest";
import { svelteConfig } from "../src/svelte.js";

describe("svelteConfig", () => {
  it("enables runes", () => {
    expect(svelteConfig.compilerOptions.runes).toBe(true);
  });

  it("preprocesses with one preprocessor", () => {
    expect(svelteConfig.preprocess).toHaveLength(1);
  });

  describe("mixed text nodes", () => {
    const compileScreen = (markup: string): string =>
      compile(`<script>let { a, b } = $props();</script>${markup}`, {
        ...svelteConfig.compilerOptions,
        generate: "client",
      }).js.code;

    it("still emit a nullish guard per interpolation, the phantom v8 branch", () => {
      expect(compileScreen("<span>{a} - {b} votes</span>")).toContain("?? ''");
    });

    it("emit no guard for a single template literal", () => {
      expect(compileScreen(`<span>{\`\${a} - \${b} votes\`}</span>`)).not.toContain("?? ''");
    });

    it("emit no guard for a single expression", () => {
      expect(compileScreen("<span>{a}</span>")).not.toContain("?? ''");
    });
  });
});
