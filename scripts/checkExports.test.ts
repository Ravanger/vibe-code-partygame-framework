import { describe, expect, it } from "vitest";
import {
  checkConditionOrder,
  checkExports,
  checkSourceConditions,
  diffSnapshot,
  type PackageExports,
  type Snapshot,
  type SubpathEntry,
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
