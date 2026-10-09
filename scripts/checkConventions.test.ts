import { describe, expect, it } from "vitest";
import { checkConventions } from "./checkConventions.js";

const check = (path: string, text: string) => checkConventions([{ path, text }]);
const rules = (path: string, text: string) => check(path, text).map((v) => v.rule);

describe("checkConventions", () => {
  it("flags the brand case-insensitively in every file, AGENTS.md included", () => {
    const brand = ["Jack", "Box"].join("");
    expect(check("docs/a.md", `ok\nsee ${brand}`)).toEqual([
      { rule: "brand", path: "docs/a.md", line: 2, message: "names a commercial brand" },
    ]);
    expect(rules("AGENTS.md", brand)).toEqual(["brand"]);
    expect(check("docs/a.md", "clean")).toEqual([]);
  });

  it("flags game vocabulary in packages except the cli template", () => {
    expect(rules("packages/core/src/a.ts", "const wit_clash = 1; // WitClash")).toEqual([
      "vocabulary",
    ]);
    expect(rules("packages/core/src/a.ts", "a matchup")).toEqual(["vocabulary"]);
    expect(rules("packages/core/README.md", "Categories")).toEqual(["vocabulary"]);
    expect(rules("packages/core/src/a.ts", "const prompt = 1")).toEqual(["vocabulary"]);
    expect(rules("packages/terminal/src/a.ts", "const prompt = 1")).toEqual([]);
    expect(rules("packages/terminal/src/a.ts", "a category")).toEqual(["vocabulary"]);
    expect(rules("packages/cli/template/a.ts", "category prompt matchup")).toEqual([]);
    expect(rules("games/x/src/a.ts", "category prompt matchup")).toEqual([]);
    expect(rules("packages/core/src/a.ts", "const item = 1")).toEqual([]);
  });

  it("forbids decorator compiler options in tsconfig files, comments and trailing commas allowed", () => {
    const on = `{ // c\n "compilerOptions": { "experimentalDecorators": true, }, }`;
    expect(check("x/tsconfig.json", on)).toEqual([
      {
        rule: "decorators",
        path: "x/tsconfig.json",
        line: 1,
        message: "experimentalDecorators is true: decorators are forbidden",
      },
    ]);
    expect(
      rules("x/tsconfig.test.json", '{"compilerOptions":{"emitDecoratorMetadata":true}}'),
    ).toEqual(["decorators"]);
    expect(
      rules("x/tsconfig.json", '{"compilerOptions":{"experimentalDecorators":false}}'),
    ).toEqual([]);
    expect(rules("x/tsconfig.json", "{}")).toEqual([]);
    expect(rules("x/tsconfig.json", '{"compilerOptions":1}')).toEqual([]);
    expect(rules("x/tsconfig.json", "not json")).toEqual([]);
    expect(rules("x/other.json", on)).toEqual([]);
    expect(rules("x/a.md", on)).toEqual([]);
  });

  it("restricts files in the repo root to an allowlist", () => {
    expect(check("NOTES.md", "x")).toEqual([
      {
        rule: "root-files",
        path: "NOTES.md",
        line: 1,
        message: "file is not on the repo root allowlist",
      },
    ]);
    expect(rules("package.json", "{}")).toEqual([]);
    expect(rules(".gitignore", "")).toEqual([]);
    expect(rules("docs/NOTES.md", "x")).toEqual([]);
  });
});
