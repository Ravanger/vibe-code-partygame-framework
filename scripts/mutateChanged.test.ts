import { describe, expect, it } from "vitest";
import { codeChanged, mutateTargets, strykerArgs } from "./mutateChanged.js";

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

describe("codeChanged", () => {
  const tpl = (code: string): string => code.replaceAll("@{", "$" + "{");
  const base = "export const a = 1;\n";

  it("ignores a JSDoc-only edit", () => {
    expect(codeChanged(base, `/** One. */\n${base}`)).toBe(false);
  });

  it("ignores a line-comment-only edit", () => {
    expect(codeChanged(base, `${base}// note\n`)).toBe(false);
  });

  it("ignores whitespace and formatting", () => {
    expect(codeChanged(base, "export  const\n  a = 1 ;")).toBe(false);
  });

  it("detects a changed token", () => {
    expect(codeChanged(base, "export const a = 2;\n")).toBe(true);
  });

  it("detects a change inside a string holding comment markers", () => {
    expect(codeChanged('const u = "a//b";', 'const u = "a//c";')).toBe(true);
  });

  it("detects a change inside a template literal holding comment markers", () => {
    expect(codeChanged(tpl("const u = `a//@{x}b`;"), tpl("const u = `a//@{y}b`;"))).toBe(true);
  });

  it("detects a token added after a template literal", () => {
    expect(codeChanged(tpl("const u = `a@{x}b`;"), tpl("const u = `a@{x}b`; f();"))).toBe(true);
  });

  it("detects a change after a template with several substitutions and braces", () => {
    const code = tpl("const u = `a@{{ k: 1 }.k}b@{y}c`; // x\nconst z = 1;");
    expect(codeChanged(code, tpl("const u = `a@{{ k: 1 }.k}b@{y}c`;\nconst z = 1;"))).toBe(false);
    expect(codeChanged(code, code.replace("z = 1", "z = 2"))).toBe(true);
  });

  it("treats a new file as changed", () => {
    expect(codeChanged(undefined, base)).toBe(true);
  });
});
