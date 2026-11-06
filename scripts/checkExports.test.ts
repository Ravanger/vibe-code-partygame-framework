import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildCurrent,
  checkConditionOrder,
  checkExports,
  checkSourceConditions,
  diffSnapshot,
  type PackageExports,
  type Snapshot,
  type SubpathEntry,
  undocumentedExports,
} from "./checkExports.js";

const entry = (
  symbols: SubpathEntry["symbols"] = {},
  target: unknown = "./a.ts",
): SubpathEntry => ({
  target,
  symbols,
});

describe("diffSnapshot", () => {
  const snapshot = { shared: { ".": entry({ a: {}, b: { experimental: true } }) } };

  it("is silent when nothing changed, ignoring the source flag", () => {
    const flagged = { shared: { ".": { ...snapshot.shared["."], source: true as const } } };
    expect(diffSnapshot(snapshot, flagged)).toEqual([]);
  });

  it("names an added symbol", () => {
    const current = { shared: { ".": entry({ a: {}, b: { experimental: true }, x: {} }) } };
    expect(diffSnapshot(current, snapshot)).toEqual(["shared . : symbol added: x"]);
  });

  it("names a removed symbol", () => {
    const current = { shared: { ".": entry({ a: {}, b: { experimental: true } }) } };
    const older = { shared: { ".": entry({ a: {}, b: { experimental: true }, y: {} }) } };
    expect(diffSnapshot(current, older)).toEqual(["shared . : symbol removed: y"]);
  });

  it("names an experimental change", () => {
    const current = { shared: { ".": entry({ a: { experimental: true }, b: {} }) } };
    expect(diffSnapshot(current, snapshot)).toEqual([
      "shared . : experimental changed: a",
      "shared . : experimental changed: b",
    ]);
  });

  it("names an added and a removed subpath", () => {
    const current = { shared: { ".": snapshot.shared["."], "./new": entry() } };
    expect(diffSnapshot(current, snapshot)).toEqual(["shared ./new : subpath added"]);
    expect(diffSnapshot(snapshot, current)).toEqual(["shared ./new : subpath removed"]);
  });

  it("names a changed target", () => {
    const current = { shared: { ".": { ...snapshot.shared["."], target: "./b.ts" } } };
    expect(diffSnapshot(current, snapshot)).toEqual(["shared . : exports target changed"]);
  });

  it("names an added and a removed package", () => {
    expect(diffSnapshot({ ...snapshot, bots: {} }, snapshot)).toEqual(["bots: package added"]);
    expect(diffSnapshot(snapshot, { ...snapshot, bots: {} })).toEqual(["bots: package removed"]);
  });
});

describe("checkConditionOrder", () => {
  it("accepts types first and ignores string targets", () => {
    expect(checkConditionOrder({ ".": { types: "./t", default: "./d" }, "./x": "./x.ts" })).toEqual(
      [],
    );
  });

  it("names a subpath whose first condition is not types", () => {
    expect(checkConditionOrder({ ".": { import: "./d", types: "./t" } })).toEqual(["."]);
  });
});

describe("checkSourceConditions", () => {
  it("allows svelte and string targets to point into src", () => {
    expect(
      checkSourceConditions({
        ".": entry({}, { types: "./dist/i.d.ts", svelte: "./src/i.ts", default: "./dist/i.js" }),
        "./x": entry({}, "./src/x.ts"),
      }),
    ).toEqual([]);
  });

  it("allows src for a subpath flagged as source", () => {
    expect(
      checkSourceConditions({ "./c": { ...entry({}, { types: "./src/c.ts" }), source: true } }),
    ).toEqual([]);
  });

  it("names a subpath with a src condition that is not svelte", () => {
    expect(checkSourceConditions({ "./c": entry({}, { types: "./src/c.ts" }) })).toEqual(["./c"]);
  });

  it("ignores conditions that are not strings", () => {
    expect(checkSourceConditions({ "./c": entry({}, { types: { nested: 1 } }) })).toEqual([]);
  });
});

describe("checkExports", () => {
  const bad: Record<string, PackageExports> = {
    core: { ".": entry({}, { import: "./d", types: "./t" }) },
  };
  const snapshotOf = (
    packages: Record<string, PackageExports>,
    knownViolations: Snapshot["knownViolations"] = [],
  ): Snapshot => ({ knownViolations, packages });

  it("reports rule violations and snapshot drift", () => {
    expect(checkExports(bad, snapshotOf(bad))).toEqual([
      "core . : types must be the first condition",
    ]);
    expect(
      checkExports(
        { core: { "./z": entry({}, { types: "./src/z.ts" }) } },
        snapshotOf({ core: {} }),
      ),
    ).toEqual([
      "core ./z : subpath added",
      "core ./z : only the svelte condition or a source subpath may point into ./src/",
    ]);
  });

  it("honours the source flag from the snapshot", () => {
    const flagged: Record<string, PackageExports> = {
      ui: { "./c": { ...entry({}, { types: "./src/c.ts" }), source: true } },
    };
    expect(
      checkExports({ ui: { "./c": entry({}, { types: "./src/c.ts" }) } }, snapshotOf(flagged)),
    ).toEqual([]);
  });

  it("tolerates a known violation and flags a stale one", () => {
    const known = [{ package: "core", rule: "types-first" as const, issue: 115 }];
    expect(checkExports(bad, snapshotOf(bad, known))).toEqual([]);
    const fixed = { core: { ".": entry({}, { types: "./t", import: "./d" }) } };
    expect(checkExports(fixed, snapshotOf(fixed, known))).toEqual([
      "core: known violation types-first (#115) no longer occurs, remove it",
    ]);
  });
});

describe("undocumentedExports", () => {
  it("is silent when every symbol and member is documented", () => {
    const current = { core: { ".": entry({ a: {}, b: { experimental: true } }) } };
    expect(undocumentedExports(current)).toEqual([]);
  });

  it("names an undocumented symbol", () => {
    const current = { core: { "./testing": entry({ a: {}, Foo: { undocumented: true } }) } };
    expect(undocumentedExports(current)).toEqual(["core ./testing : undocumented: Foo"]);
  });

  it("names an undocumented member of a class", () => {
    const current = { core: { ".": entry({ Foo: { undocumentedMembers: ["run", "stop"] } }) } };
    expect(undocumentedExports(current)).toEqual([
      "core . : undocumented: Foo#run",
      "core . : undocumented: Foo#stop",
    ]);
  });

  it("is part of checkExports", () => {
    const current = { core: { ".": entry({ Foo: { undocumented: true } }) } };
    const snapshot: Snapshot = {
      knownViolations: [],
      packages: { core: { ".": entry({ Foo: {} }) } },
    };
    expect(checkExports(current, snapshot)).toEqual(["core . : undocumented: Foo"]);
  });
});

describe("buildCurrent", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  const workspace = (files: Record<string, string>): string => {
    const root = mkdtempSync(join(tmpdir(), "exports-"));
    dirs.push(root);
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    return root;
  };

  const manifest = (name: string, exportsMap?: unknown): string =>
    JSON.stringify({ name, exports: exportsMap });
  const dist = { types: "./dist/index.d.ts", default: "./dist/index.js" };
  const none: Snapshot = { knownViolations: [], packages: {} };

  const files = {
    "packages/b/package.json": manifest("@partygame/b", {
      ".": dist,
      "./extra": { svelte: "./src/extra.ts" },
      "./data.json": "./data.json",
      "./skip": { types: "./t.d.ts" },
      "./empty": {},
      "./off": null,
      "./plain": "./src/plain.ts",
    }),
    "packages/b/src/index.ts": [
      "/** A documented class. */",
      "export class Base {",
      "  /** Documented. */",
      "  run(): void {}",
      "}",
      "/** Props. */",
      "export interface Doc {",
      "  /** Runs. */",
      "  run(): void;",
      "}",
      "/** Flag.",
      " * @experimental */",
      "export const flag = 1;",
      "/** Empty. */",
      "export class Empty {}",
      "/** Alpha. */",
      "export const alpha = 1;",
      "",
    ].join("\n"),
    "packages/b/src/plain.ts": "const local = 1;\n",
    "packages/b/src/extra.ts": "export const extra = 1;\n",
    "packages/a/package.json": manifest("@partygame/a", { ".": dist }),
    "packages/a/src/index.ts": [
      'import type { Doc } from "@partygame/b";',
      'export { Base } from "@partygame/b";',
      "/** Mine. */",
      "export class Mine implements Doc {",
      "  private hidden(): void {}",
      "  protected guarded(): void {}",
      "  #secret(): void {}",
      "  field = 1;",
      "  get value(): number { return 1; }",
      "  set value(_v: number) {}",
      "  run(): void {}",
      "  bare(): void {}",
      "  static make(): Mine { return new Mine(); }",
      "}",
      "",
    ].join("\n"),
    "packages/none/package.json": manifest("@partygame/none"),
    "packages/stray/readme.txt": "no manifest",
  };

  it("resolves a workspace re-export to its source with no dist build", () => {
    const current = buildCurrent(workspace(files), none);
    expect(current.a?.["."]?.symbols.Base).toEqual({});
  });

  it("takes docs inherited from an implemented workspace interface", () => {
    const current = buildCurrent(workspace(files), none);
    expect(current.a?.["."]?.symbols.Mine).toEqual({
      undocumentedMembers: ["bare", "make", "value"],
    });
  });

  it("reports experimental symbols, source subpaths and the source flag", () => {
    const previous: Snapshot = {
      knownViolations: [],
      packages: { b: { "./extra": { target: {}, symbols: {}, source: true } } },
    };
    const current = buildCurrent(workspace(files), previous);
    expect(current.b?.["."]?.symbols.flag).toEqual({ experimental: true });
    expect(current.b?.["./extra"]).toMatchObject({ source: true });
    expect(current.b?.["./extra"]?.symbols.extra).toEqual({ undocumented: true });
    expect(current.b?.["./data.json"]?.symbols).toEqual({});
    expect(current.b?.["./skip"]?.symbols).toEqual({});
    expect(current.b?.["./empty"]?.symbols).toEqual({});
    expect(current.b?.["./off"]?.symbols).toEqual({});
    expect(current.b?.["./plain"]?.symbols).toEqual({});
    expect(Object.keys(current.b?.["."]?.symbols ?? {})).toEqual([
      "Base",
      "Doc",
      "Empty",
      "alpha",
      "flag",
    ]);
    expect(current.none).toBeUndefined();
  });
});
