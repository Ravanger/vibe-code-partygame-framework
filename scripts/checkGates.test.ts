import { describe, expect, it } from "vitest";
import {
  checkGates,
  diffRange,
  isScannedPath,
  labelsOf,
  NO_TEST_LABEL,
  OVERRIDE_LABEL,
  ownerLabels,
  parseDiff,
  scanTree,
  TREE_ALLOWLIST,
  trustedLabels,
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
      { path: "a.ts", added: ["new"], removed: ["old"], removedKeys: [undefined] },
      { path: "b.ts", added: ["more"], removed: [], removedKeys: [] },
    ]);
  });

  it("ignores context lines and text before the first file", () => {
    const diff = ["preamble", "diff --git a/a.ts b/a.ts", "@@ -1 +1 @@", " context", "+new"].join(
      "\n",
    );
    expect(parseDiff(diff)).toEqual([
      { path: "a.ts", added: ["new"], removed: [], removedKeys: [] },
    ]);
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
    ["xit('x', () => {});", "focused-or-skipped-test"],
    ["xdescribe('x', () => {});", "focused-or-skipped-test"],
    ["xtest('x', () => {});", "focused-or-skipped-test"],
    ["it.fails('x', () => {});", "focused-or-skipped-test"],
    ["test.fails('x', () => {});", "focused-or-skipped-test"],
    ["it.skip.each([1])('x', () => {});", "focused-or-skipped-test"],
    ["it.only.each([1])('x', () => {});", "focused-or-skipped-test"],
    ["test.todo.each([1])('x');", "focused-or-skipped-test"],
    ["const a = b as any;", "type-escape"],
    ["const a = b as unknown as C;", "type-escape"],
  ])("rejects added line %s", (line, rule) => {
    expect(rules(diffOf("packages/core/src/a.ts", [], [line]))).toEqual([rule]);
  });

  describe("approved lines", () => {
    const bailOut = '    ctx.skip("symlinks not permitted on this machine");';

    it("allows the maintainer-approved #129 symlink bail-out in the content test", () => {
      expect(rules(diffOf("packages/content/tests/content.test.ts", [], [bailOut]))).toEqual([]);
    });

    it("approves nothing else, in that file or anywhere", () => {
      expect(
        rules(diffOf("packages/content/tests/content.test.ts", [], ["it.skip('x', () => {});"])),
      ).toEqual(["focused-or-skipped-test"]);
      expect(rules(diffOf("packages/core/src/a.ts", [], [bailOut]))).toEqual([
        "focused-or-skipped-test",
      ]);
    });
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
    "scripts/bundle-budget.json",
    "scripts/bundleSize.ts",
    "scripts/bundleSizeCli.ts",
    "scripts/exports.snapshot.json",
    "scripts/vitest.config.ts",
    "scripts/tsconfig.json",
    "turbo.json",
    "tsconfig.base.json",
    "packages/config/src/vitest.ts",
    "packages/config/tsconfig.base.json",
    "packages/config/tsconfig.game.json",
    "packages/config/node-test-setup.ts",
  ])("rejects edits to %s", (path) => {
    expect(rules(diffOf(path, [], ["x"]))).toEqual(["protected-path"]);
  });

  it("does not protect unrelated scripts or nested paths", () => {
    expect(rules(diffOf("scripts/game.ts", [], ["x"]))).toEqual([]);
    expect(rules(diffOf("packages/config/README.md", [], ["x"]))).toEqual([]);
    expect(rules(diffOf("packages/core/vitest.config.ts", [], ["x"]))).toEqual([]);
    expect(rules(diffOf("games/wit-clash/vitest.config.ts", [], ["x"]))).toEqual([]);
    expect(rules(diffOf("packages/core/tsconfig.base.json", [], ["x"]))).toEqual([]);
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
    ["packages/core/tsconfig.json", ['    "strict": true,'], []],
    ["packages/core/tsconfig.test.json", [], ['    "noUncheckedIndexedAccess": false']],
    ["games/x/tsconfig.json", ['    "noImplicitReturns": true,'], []],
    ["tsconfig.json", [], ['    "strictNullChecks": false,']],
    ["tsconfig.json", [], ['    "noUnusedLocals": false,']],
    ["tsconfig.json", [], ['    "noFallthroughCasesInSwitch": false,']],
    ["tsconfig.json", [], ['    "exactOptionalPropertyTypes": false,']],
  ])("rejects a relaxed compiler option in %s", (path, removed, added) => {
    expect(rules(diffOf(path, removed, added))).toEqual(["compiler-option"]);
  });

  it.each([
    [
      "games/x/tsconfig.json",
      ['  "include": ["src/**/*.ts", "ui/**/*.ts"]'],
      ['  "include": ["src/**/*.ts"]'],
    ],
    ["games/x/tsconfig.json", ['    "ui/**/*.ts",'], []],
    ["packages/core/tsconfig.json", [], ['  "exclude": ["src/big"]']],
  ])("rejects a shrunk include or an added exclude in %s", (path, removed, added) => {
    expect(rules(diffOf(path, removed, added))).toEqual(["tsconfig-scope"]);
  });

  it.each([
    ["exclude", false],
    ["files", false],
    ["types", false],
    ["include", true],
  ])("judges a removed entry of the %s array by its enclosing key", (key, rejected) => {
    const diff = [
      "diff --git a/tsconfig.json b/tsconfig.json",
      "--- a/tsconfig.json",
      "+++ b/tsconfig.json",
      "@@ -1,9 +1,8 @@",
      " {",
      `   "${key}": [`,
      '     "a",',
      '-    "b",',
      '     "c"',
      "   ],",
      '   "other": [',
      '     "d"',
      "   ]",
      " }",
    ].join("\n");
    expect(rules(diff)).toEqual(rejected ? ["tsconfig-scope"] : []);
  });

  it("accepts a grown or reordered include and unrelated tsconfig edits", () => {
    const grown = diffOf(
      "games/x/tsconfig.json",
      ['    "terminal/**/*.ts"'],
      ['    "terminal/**/*.ts",', '    "gamePackage.ts"'],
    );
    expect(rules(grown)).toEqual([]);
    const widened = diffOf(
      "tsconfig.json",
      ['  "include": ["src"]'],
      ['  "include": ["src", "tests"]'],
    );
    expect(rules(widened)).toEqual([]);
    expect(
      rules(diffOf("tsconfig.json", ['  "extends": "./a.json",'], ['  "extends": "./b.json",'])),
    ).toEqual([]);
    expect(rules(diffOf("packages/x/src/a.ts", [], ['  "exclude": ["a"]']))).toEqual([]);
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

  it.each([
    "games/x/ui/viewmodels/Foo.ts",
    "games/x/bots/xBot.ts",
    "games/x/terminal/xTerminal.ts",
    "games/x/gamePackage.ts",
  ])("fails a game change to %s without a test", (path) => {
    expect(untested([diffOf(path, [], ["x"])])).toEqual(["games/x"]);
    expect(
      untested([diffOf(path, [], ["x"]), diffOf("games/x/tests/a.test.ts", [], ["x"])]),
    ).toEqual([]);
  });

  it.each([
    "games/x/ui/main.ts",
    "games/x/ui/Screen.svelte",
    "games/x/bots/cli.ts",
    "games/x/terminal/play.ts",
    "games/x/terminal/demo.ts",
    "games/x/server.ts",
    "games/x/launch.ts",
    "games/x/ui/a.d.ts",
    "packages/core/ui/a.ts",
    "packages/core/gamePackage.ts",
  ])("does not require a test for %s", (path) => {
    expect(untested([diffOf(path, [], ["x"])])).toEqual([]);
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

const labeled = (name: string, login: string, event = "labeled") => ({
  event,
  label: { name },
  actor: { login },
});

describe("ownerLabels", () => {
  it("counts a label the owner added", () => {
    expect(ownerLabels([labeled("gate-change", "boss")], "boss")).toEqual(["gate-change"]);
  });

  it("ignores a label added by anyone else", () => {
    expect(ownerLabels([labeled("gate-change", "mallory")], "boss")).toEqual([]);
  });

  it("lets the latest event win, so a removal or a re-add by someone else revokes it", () => {
    const removed = [labeled("a", "boss"), labeled("a", "boss", "unlabeled")];
    expect(ownerLabels(removed, "boss")).toEqual([]);
    const readded = [
      labeled("a", "boss"),
      labeled("a", "mallory", "unlabeled"),
      labeled("a", "mallory"),
    ];
    expect(ownerLabels(readded, "boss")).toEqual([]);
  });

  it("flattens paginated pages and skips malformed or unrelated events", () => {
    const pages = [
      [labeled("a", "boss")],
      [labeled("b", "boss"), { event: "closed" }, null, { event: "labeled" }],
    ];
    expect(ownerLabels(pages, "boss")).toEqual(["a", "b"]);
    expect(ownerLabels({ not: "an array" }, "boss")).toEqual([]);
    expect(ownerLabels([{ event: "labeled", label: { name: "x" } }], "boss")).toEqual([]);
  });
});

describe("trustedLabels", () => {
  const event = {
    pull_request: {
      labels: [{ name: "gate-change" }, { name: "no-test-needed" }, { name: "bug" }],
    },
  };

  it("keeps only owner-added override labels", () => {
    const events = [labeled("gate-change", "boss"), labeled("no-test-needed", "mallory")];
    expect(trustedLabels(event, events, "boss")).toEqual(["gate-change"]);
  });

  it("drops a label present on the PR that no event shows the owner adding", () => {
    expect(trustedLabels(event, [], "boss")).toEqual([]);
  });

  it("does not let a forged label name in the payload count without an event", () => {
    expect(
      checkGates(diffOf("biome.json", [], ["{}"]), trustedLabels(event, [], "boss")),
    ).not.toEqual([]);
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

describe("scanTree", () => {
  const found = (path: string, content: string, allowlist = TREE_ALLOWLIST) =>
    scanTree([{ path, content }], allowlist);

  it("flags a suppression or a skipped test anywhere in the tree", () => {
    expect(found("packages/core/src/a.ts", "const a = 1;\nconst b = 2; // biome-ignore x")).toEqual(
      [
        {
          path: "packages/core/src/a.ts",
          rule: "suppression",
          detail: "const b = 2; // biome-ignore x",
        },
      ],
    );
    expect(found("games/x/tests/a.test.ts", "xit('a', () => {});").map((v) => v.rule)).toEqual([
      "focused-or-skipped-test",
    ]);
    expect(found("a.ts", "// @ts-expect-error y").map((v) => v.rule)).toEqual(["suppression"]);
  });

  it("leaves the type-escape rules to the diff gate", () => {
    expect(found("a.ts", "const a = b as unknown as C;")).toEqual([]);
  });

  it("passes clean files", () => {
    expect(scanTree([{ path: "a.ts", content: "export const a = 1;\n" }], [])).toEqual([]);
  });

  it("passes an allowlisted line in its own file only", () => {
    const allowlist = [{ path: "a.ts", pattern: /biome-ignore/, reason: "r" }];
    expect(found("a.ts", "// biome-ignore x", allowlist)).toEqual([]);
    expect(found("b.ts", "// biome-ignore x", allowlist).map((v) => v.path)).toEqual(["b.ts"]);
    expect(found("a.ts", "// @ts-ignore", allowlist).map((v) => v.rule)).toEqual(["suppression"]);
  });

  it("allowlists the known suppressions on main, each with a reason", () => {
    const paths = TREE_ALLOWLIST.map((entry) => entry.path).sort();
    expect(paths).toEqual([
      "packages/content/tests/content.test.ts",
      "packages/core/tests/runtime/types.test.ts",
      "packages/game-ui/src/components/GameControls.svelte",
      "packages/game-ui/src/components/GameShell.svelte",
      "packages/game-ui/src/components/LobbyScreen.svelte",
      "packages/game-ui/src/components/LobbySettings.svelte",
      "packages/game-ui/src/components/Podium.svelte",
      "packages/game-ui/src/components/WelcomeScreen.svelte",
      "packages/server/src/bun.ts",
    ]);
    expect(TREE_ALLOWLIST.every((entry) => entry.reason.length > 0)).toBe(true);
  });
});

describe("isScannedPath", () => {
  it("scans source files and skips the gate's own pattern text and other files", () => {
    expect(isScannedPath("packages/core/src/a.ts")).toBe(true);
    expect(isScannedPath("packages/game-ui/src/A.svelte")).toBe(true);
    expect(isScannedPath("vitest.config.mts")).toBe(true);
    expect(isScannedPath("scripts/checkGates.ts")).toBe(false);
    expect(isScannedPath("scripts/checkGates.test.ts")).toBe(false);
    expect(isScannedPath("docs/framework/README.md")).toBe(false);
    expect(isScannedPath("biome-plugins/a.grit")).toBe(false);
  });
});
