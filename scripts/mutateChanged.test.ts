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
      "games/wit-clash/ui/x.svelte",
      "games/wit-clash/ui/main.ts",
      "games/wit-clash/bots/cli.ts",
      "games/wit-clash/terminal/play.ts",
      "games/wit-clash/terminal/demo.ts",
      "games/wit-clash/server.ts",
      "games/wit-clash/launch.ts",
      "games/wit-clash/ui/a.d.ts",
      "games/wit-clash/ui/a.test.ts",
      "games/wit-clash/src/x.svelte",
      "packages/core/ui/a.ts",
      "packages/core/gamePackage.ts",
      "scripts/foo.ts",
      "README.md",
      "",
    ].join("\n");
    expect(mutateTargets(out)).toEqual([]);
  });
});

describe("mutateTargets for game files outside src", () => {
  it("keeps ui, bots, terminal and gamePackage typescript", () => {
    const paths = [
      "games/x/ui/viewmodels/Foo.ts",
      "games/x/bots/xBot.ts",
      "games/x/terminal/xTerminal.ts",
      "games/x/gamePackage.ts",
    ];
    expect(mutateTargets(paths.join("\n"))).toEqual(paths);
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
