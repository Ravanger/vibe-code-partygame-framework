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

  it("flags sessionId outside packages/server in ts and svelte files", () => {
    const text = "const x = sessionId;";
    expect(rules("packages/core/src/a.ts", text)).toEqual(["sessionId"]);
    expect(rules("games/x/ui/a.svelte", text)).toEqual(["sessionId"]);
    expect(rules("packages/server/src/a.ts", text)).toEqual([]);
    expect(rules("docs/a.md", text)).toEqual([]);
    expect(rules("scripts/checkConventions.test.ts", text)).toEqual([]);
    expect(rules("packages/core/src/a.ts", "const mySessionIdx = 1;")).toEqual([]);
  });

  it("allows only node: specifiers in vi.mock and vi.doMock", () => {
    expect(check("x/a.test.ts", 'vi.mock("./x");').map((v) => [v.rule, v.line])).toEqual([
      ["vi.mock", 1],
    ]);
    expect(rules("x/a.test.ts", "vi.doMock('x', () => ({}));")).toEqual(["vi.mock"]);
    expect(rules("x/a.test.ts", 'vi.mock("node:fs");')).toEqual([]);
    expect(rules("x/a.test.ts", 'vi.doMock("node:fs");')).toEqual([]);
    expect(rules("x/a.test.ts", "vi.mock(factory);")).toEqual([]);
    expect(rules("x/a.md", 'vi.mock("./x");')).toEqual([]);
  });

  it("forbids decorator compiler options in json, ts and mts", () => {
    const text = '{ "experimentalDecorators": true }';
    expect(rules("x/tsconfig.json", text)).toEqual(["decorators"]);
    expect(rules("x/a.ts", "emitDecoratorMetadata")).toEqual(["decorators"]);
    expect(rules("x/a.mts", "emitDecoratorMetadata")).toEqual(["decorators"]);
    expect(rules("x/a.md", text)).toEqual([]);
    expect(rules("x/tsconfig.json", "{}")).toEqual([]);
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
