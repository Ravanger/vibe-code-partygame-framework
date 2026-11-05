import { describe, expect, it } from "vitest";
import { checkConventions } from "./checkConventions.js";

const check = (path: string, text: string) => checkConventions([{ path, text }]);
const rules = (path: string, text: string) => check(path, text).map((v) => v.rule);

describe("checkConventions", () => {
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
    // #14: the template-versions test pins ranges to the reference game's manifest and must name it.
    expect(rules("packages/cli/tests/templateVersions.test.ts", "games/wit-clash")).toEqual([]);
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
    expect(rules("bunfig.toml", '[install]\nlinker = "hoisted"\n')).toEqual([]);
    expect(rules(".gitignore", "")).toEqual([]);
    expect(rules("docs/NOTES.md", "x")).toEqual([]);
  });

  describe("provenance", () => {
    const manifest = (entries: unknown) => ({
      path: "games/x/content/provenance.json",
      text: JSON.stringify(entries),
    });
    const content = (name: string) => ({ path: `games/x/content/${name}`, text: "{}" });
    const messages = (files: { path: string; text: string }[]) =>
      checkConventions(files)
        .filter((v) => v.rule === "provenance")
        .map((v) => `${v.path}: ${v.message}`);

    it("accepts a manifest listing every content file as original or with a source and licence", () => {
      expect(
        messages([
          manifest({ "a.jsonc": "original", "sub/b.jsonc": { source: "S", license: "MIT" } }),
          content("a.jsonc"),
          content("sub/b.jsonc"),
        ]),
      ).toEqual([]);
    });

    it("ignores games without content files and files outside content trees", () => {
      expect(messages([{ path: "games/x/src/a.ts", text: "" }])).toEqual([]);
      expect(messages([manifest({})])).toEqual([]);
    });

    it("flags a content tree with no manifest", () => {
      expect(messages([content("a.jsonc")])).toEqual([
        "games/x/content/a.jsonc: games/x/content has no provenance.json",
      ]);
    });

    it("flags a content file missing from the manifest", () => {
      expect(
        messages([manifest({ "a.jsonc": "original" }), content("a.jsonc"), content("b.jsonc")]),
      ).toEqual(["games/x/content/b.jsonc: not listed in provenance.json"]);
    });

    it("flags a manifest entry with no file", () => {
      expect(messages([manifest({ "gone.jsonc": "original" }), content("a.jsonc")])).toEqual([
        "games/x/content/provenance.json: gone.jsonc has no file",
        "games/x/content/a.jsonc: not listed in provenance.json",
      ]);
    });

    it.each([
      ["a wrong string", { "a.jsonc": "copied" }],
      ["a missing licence", { "a.jsonc": { source: "S" } }],
      ["an empty source", { "a.jsonc": { source: "", license: "MIT" } }],
      ["an extra key", { "a.jsonc": { source: "S", license: "MIT", x: 1 } }],
      ["a non-object manifest", ["a.jsonc"]],
    ])("flags %s", (_label, entries) => {
      const found = messages([manifest(entries), content("a.jsonc")]);
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("games/x/content/provenance.json: invalid manifest");
    });

    it("flags a manifest that is not JSON", () => {
      expect(
        messages([{ path: "games/x/content/provenance.json", text: "{" }, content("a.jsonc")]),
      ).toEqual(["games/x/content/provenance.json: provenance.json is not valid JSON"]);
    });
  });
});
