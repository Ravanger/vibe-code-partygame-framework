import { describe, expect, it } from "vitest";
import { mutateTargets, strykerArgs } from "./mutateChanged.js";

describe("mutateTargets", () => {
  it("keeps package and game source files", () => {
    const out = "packages/core/src/a.ts\ngames/wit-clash/src/phases/B.ts\n";
    expect(mutateTargets(out)).toEqual([
      "packages/core/src/a.ts",
      "games/wit-clash/src/phases/B.ts",
    ]);
  });

  it("drops declarations, tests, docs, ui and scripts", () => {
    const out = [
      "packages/core/src/a.d.ts",
      "packages/core/src/a.test.ts",
      "packages/core/tests/a.ts",
      "games/wit-clash/ui/x.ts",
      "games/wit-clash/src/x.svelte",
      "scripts/foo.ts",
      "README.md",
      "",
    ].join("\n");
    expect(mutateTargets(out)).toEqual([]);
  });
});

describe("strykerArgs", () => {
  it("joins targets into one --mutate list", () => {
    expect(strykerArgs(["a.ts", "b.ts"])).toEqual([
      "run",
      "scripts/stryker.config.json",
      "--mutate",
      "a.ts,b.ts",
    ]);
  });
});
