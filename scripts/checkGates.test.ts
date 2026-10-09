import { describe, expect, it } from "vitest";
import {
  checkGates,
  diffRange,
  labelsOf,
  NO_TEST_LABEL,
  OVERRIDE_LABEL,
  parseDiff,
} from "./checkGates.js";

const diffOf = (path: string, removed: string[], added: string[]): string =>
  [
    `diff --git a/${path} b/${path}`,
    "index 1..2 100644",
    `--- a/${path}`,
    `+++ b/${path}`,
    "@@ -1 +1 @@",
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
  ].join("\n");

const rules = (diff: string, labels: string[] = []): string[] =>
  checkGates(diff, labels).map((violation) => violation.rule);

describe("parseDiff", () => {
  it("splits a diff per file and ignores lines outside hunks", () => {
    const diff = `${diffOf("a.ts", ["old"], ["new"])}\n${diffOf("b.ts", [], ["more"])}`;
    expect(parseDiff(diff)).toEqual([
      { path: "a.ts", added: ["new"], removed: ["old"] },
      { path: "b.ts", added: ["more"], removed: [] },
    ]);
  });

  it("ignores context lines and text before the first file", () => {
    const diff = ["preamble", "diff --git a/a.ts b/a.ts", "@@ -1 +1 @@", " context", "+new"].join(
      "\n",
    );
    expect(parseDiff(diff)).toEqual([{ path: "a.ts", added: ["new"], removed: [] }]);
    expect(parseDiff("@@ -1 +1 @@\n+orphan")).toEqual([]);
  });
});

describe("checkGates", () => {
  it("passes an ordinary change", () => {
    expect(rules(diffOf("packages/core/src/a.ts", ["const a = 1;"], ["const a = 2;"]))).toEqual([]);
    expect(rules("")).toEqual([]);
  });

  it.each([
    ["// biome-ignore lint/suspicious/noExplicitAny: x", "suppression"],
    ["// @ts-ignore", "suppression"],
    ["// @ts-expect-error", "suppression"],
    ["// eslint-disable-next-line", "suppression"],
    ["// Stryker disable next-line all", "suppression"],
    ["/* v8 ignore next */", "suppression"],
    ["/* istanbul ignore next */", "suppression"],
    ["/* c8 ignore next */", "suppression"],
    ["// @ts-nocheck", "suppression"],
    ["it.skipIf(ci)('x', () => {});", "focused-or-skipped-test"],
    ["describe.runIf(ci)('x', () => {});", "focused-or-skipped-test"],
    ["it.todo('x');", "focused-or-skipped-test"],
    ["it.skip('x', () => {});", "focused-or-skipped-test"],
    ["describe.only('x', () => {});", "focused-or-skipped-test"],
    ["const a = b as any;", "type-escape"],
    ["const a = b as unknown as C;", "type-escape"],
  ])("rejects added line %s", (line, rule) => {
    expect(rules(diffOf("packages/core/src/a.ts", [], [line]))).toEqual([rule]);
  });

  it("ignores forbidden text on removed lines", () => {
    expect(rules(diffOf("packages/core/src/a.ts", ["// biome-ignore x"], []))).toEqual([]);
  });

  it.each([
    ".github/workflows/ci.yml",
    "scripts/checkBoundaries.ts",
    "lefthook.yml",
    "scripts/stryker.config.json",
    "biome.json",
    "biome-plugins/no-decorators.grit",
    ".github/actions/setup/action.yml",
    "scripts/mutateChanged.ts",
    "scripts/mutateChangedCli.ts",
    "knip.json",
    "vitest.config.mts",
  ])("rejects edits to %s", (path) => {
    expect(rules(diffOf(path, [], ["x"]))).toEqual(["protected-path"]);
  });

  it("does not protect unrelated scripts or nested paths", () => {
    expect(rules(diffOf("scripts/game.ts", [], ["x"]))).toEqual([]);
    expect(rules(diffOf("packages/x/scripts/checkA.ts", [], ["x"]))).toEqual([]);
  });

  it.each([
    ['    "test:coverage": "vitest run --coverage",', '    "test:coverage": "true",'],
    ['    "check:boundaries": "bun run x.ts",', ""],
    ['    "typecheck": "tsc -p tsconfig.test.json"', '    "typecheck": "true"'],
    ['    "verify": "biome check ."', '    "verify": "true"'],
    ['    "mutate:changed": "x"', ""],
    ['    "smoke": "bun scripts/smoke.ts"', ""],
    ['    "lint": "biome check ."', ""],
    ['    "test": "vitest run",', ""],
  ])("rejects a changed gate script %s", (before, after) => {
    const added = after === "" ? [] : [after];
    expect(rules(diffOf("package.json", [before], added))).toEqual(["gate-script"]);
    expect(rules(diffOf("packages/core/package.json", [before], added))).toEqual(["gate-script"]);
  });

  it("accepts new gate scripts and other package.json edits", () => {
    const fresh = ['    "test": "vitest run",', '    "typecheck": "tsc --noEmit"'];
    expect(rules(diffOf("games/new/package.json", [], fresh))).toEqual([]);
    expect(rules(diffOf("package.json", ['    "zod": "4.0.0",'], ['    "zod": "4.1.0",']))).toEqual(
      [],
    );
    expect(rules(diffOf("package.json", ['    "build": "turbo build",'], []))).toEqual([]);
    expect(rules(diffOf("notes/package.md", ['    "test": "x"'], []))).toEqual([]);
    const reordered = diffOf(
      "package.json",
      ['    "lint": "biome check .",', '    "test": "vitest run",'],
      ['    "test": "vitest run",', '    "lint": "biome check ."'],
    );
    expect(rules(reordered)).toEqual([]);
    for (const name of ["lint-staged", "testing", "smoker", "typechecker"])
      expect(rules(diffOf("package.json", [`    "${name}": "x",`], []))).toEqual([]);
  });

  it.each([
    ["tsconfig.json", [], ['    "strict": false,']],
    ["packages/config/tsconfig.base.json", ['    "strict": true,'], []],
    ["packages/core/tsconfig.test.json", [], ['    "noUncheckedIndexedAccess": false']],
    ["games/x/tsconfig.json", ['    "noImplicitReturns": true,'], []],
    ["tsconfig.json", [], ['    "strictNullChecks": false,']],
    ["tsconfig.json", [], ['    "noUnusedLocals": false,']],
    ["tsconfig.json", [], ['    "noFallthroughCasesInSwitch": false,']],
    ["tsconfig.json", [], ['    "exactOptionalPropertyTypes": false,']],
  ])("rejects a relaxed compiler option in %s", (path, removed, added) => {
    expect(rules(diffOf(path, removed, added))).toEqual(["compiler-option"]);
  });

  it("accepts tightened or unrelated compiler options", () => {
    expect(
      rules(diffOf("tsconfig.json", ['    "strict": false,'], ['    "strict": true,'])),
    ).toEqual([]);
    expect(
      rules(diffOf("tsconfig.json", ['    "noEmit": true,'], ['    "noEmit": false,'])),
    ).toEqual([]);
    expect(rules(diffOf("packages/x/src/a.ts", [], ['const o = { "strict": false };']))).toEqual(
      [],
    );
  });

  it("lets the gate-change label override everything", () => {
    const diff = diffOf(".github/workflows/ci.yml", [], ["// biome-ignore x"]);
    expect(rules(diff)).toEqual(["suppression", "protected-path"]);
    expect(rules(diff, ["bug", OVERRIDE_LABEL])).toEqual([]);
  });
});

const renameOf = (from: string, to: string): string =>
  [
    `diff --git a/${from} b/${to}`,
    "similarity index 100%",
    `rename from ${from}`,
    `rename to ${to}`,
  ].join("\n");

const untested = (diffs: string[], labels: string[] = []): string[] =>
  checkGates(diffs.join("\n"), labels, true).map((violation) => violation.path);

describe("untested-change", () => {
  const src = diffOf("packages/core/src/a.ts", [], ["x"]);

  it("fails a change to src without a test", () => {
    const found = checkGates(src, [], true);
    expect(found).toEqual([
      {
        path: "packages/core",
        rule: "untested-change",
        detail: "src changed without a *.test.ts change",
      },
    ]);
  });

  it("passes src with a test in tests/ or next to src", () => {
    expect(untested([src, diffOf("packages/core/tests/a.test.ts", [], ["x"])])).toEqual([]);
    expect(untested([src, diffOf("packages/core/src/a.test.ts", [], ["x"])])).toEqual([]);
  });

  it("reports each package and game once", () => {
    const games = diffOf("games/wit-clash/src/b.ts", [], ["y"]);
    const more = diffOf("packages/core/src/c.ts", [], ["z"]);
    expect(untested([src, more, games])).toEqual(["packages/core", "games/wit-clash"]);
  });

  it("does not take a test from another package", () => {
    const other = diffOf("packages/shared/tests/a.test.ts", [], ["x"]);
    expect(untested([src, other])).toEqual(["packages/core"]);
  });

  it("passes a test-only change", () => {
    expect(untested([diffOf("packages/core/tests/a.test.ts", [], ["x"])])).toEqual([]);
  });

  it("ignores d.ts, renames, removals and files outside src", () => {
    expect(untested([diffOf("packages/core/src/a.d.ts", [], ["x"])])).toEqual([]);
    expect(untested([renameOf("packages/core/src/a.ts", "packages/core/src/b.ts")])).toEqual([]);
    expect(untested([diffOf("packages/core/src/a.ts", ["x"], [])])).toEqual([]);
    expect(untested([diffOf("packages/core/README.md", [], ["x"])])).toEqual([]);
    expect(untested([diffOf("scripts/game.ts", [], ["x"])])).toEqual([]);
  });

  it("is off unless requested, as when checking staged files", () => {
    expect(rules(src)).toEqual([]);
  });

  it("is overridden by no-test-needed alone", () => {
    expect(untested([src], [NO_TEST_LABEL])).toEqual([]);
    expect(untested([src], [OVERRIDE_LABEL])).toEqual(["packages/core"]);
  });

  it("leaves the other rules to gate-change", () => {
    const bad = diffOf("packages/core/src/a.ts", [], ["// biome-ignore x"]);
    const found = checkGates(bad, [NO_TEST_LABEL], true);
    expect(found.map((violation) => violation.rule)).toEqual(["suppression"]);
  });
});

describe("labelsOf", () => {
  it("reads label names from a pull_request event", () => {
    const event = { pull_request: { labels: [{ name: "a" }, { name: 3 }, null, {}] } };
    expect(labelsOf(event)).toEqual(["a"]);
  });

  it("returns nothing for other payloads", () => {
    expect(labelsOf(null)).toEqual([]);
    expect(labelsOf("x")).toEqual([]);
    expect(labelsOf({})).toEqual([]);
    expect(labelsOf({ pull_request: {} })).toEqual([]);
  });
});

describe("diffRange", () => {
  it("diffs the index with --staged", () => {
    expect(diffRange(["--staged"])).toEqual(["--cached"]);
  });

  it("diffs against a base, defaulting to origin/main", () => {
    expect(diffRange(["--base", "dev"])).toEqual(["dev...HEAD"]);
    expect(diffRange(["--base"])).toEqual(["origin/main...HEAD"]);
    expect(diffRange([])).toEqual(["origin/main...HEAD"]);
  });
});
