import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const CORE = "@colyseus/core";
const REPO_ROOT = resolve(import.meta.dirname, "../../..");

function subdirs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function packageDirs(modulesDir: string): string[] {
  return subdirs(modulesDir).flatMap((name) =>
    name.startsWith("@")
      ? subdirs(join(modulesDir, name)).map((sub) => join(modulesDir, name, sub))
      : [join(modulesDir, name)],
  );
}

/** Real paths of every `@colyseus/core` under any `node_modules` below `root`, nested ones included. */
function findCoreCopies(root: string): string[] {
  const found = new Set<string>();
  const scanModules = (modulesDir: string): void => {
    for (const pkgDir of packageDirs(modulesDir)) {
      if (pkgDir === join(modulesDir, CORE)) {
        found.add(realpathSync(pkgDir));
      }
      try {
        scanModules(join(pkgDir, "node_modules"));
      } catch {
        // package without a nested node_modules
      }
    }
  };
  const walk = (dir: string): void => {
    for (const name of subdirs(dir)) {
      if (name === ".git") {
        continue;
      }
      if (name === "node_modules") {
        scanModules(join(dir, name));
      } else {
        walk(join(dir, name));
      }
    }
  };
  walk(root);
  return [...found].sort();
}

function colyseusConsumers(root: string): string[] {
  return ["packages", "games"].flatMap((group) =>
    subdirs(join(root, group))
      .map((name) => join(root, group, name))
      .filter((dir) => {
        const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Record<
          string,
          Record<string, string> | undefined
        >;
        const deps = ["dependencies", "devDependencies", "peerDependencies"].flatMap((key) =>
          Object.keys(manifest[key] ?? {}),
        );
        return deps.some((dep) => dep.startsWith("@colyseus/"));
      }),
  );
}

/** The real path of `@colyseus/core` as seen from each consumer, keyed by consumer directory. */
function resolveCoreFrom(consumers: string[]): Map<string, string> {
  return new Map(
    consumers.map((dir) => [
      dir,
      realpathSync(createRequire(join(dir, "package.json")).resolve(CORE)),
    ]),
  );
}

function distinctPaths(paths: Iterable<string>): string[] {
  return [...new Set(paths)].sort();
}

const scratch: string[] = [];

function scratchRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "core-singleton-"));
  scratch.push(root);
  return root;
}

function writeCore(modulesDir: string, version: string): void {
  const dir = join(modulesDir, "@colyseus", "core");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: CORE, version, main: "index.js" }),
  );
  writeFileSync(join(dir, "index.js"), "module.exports = {};");
}

function writeConsumer(root: string, group: string, name: string): string {
  const dir = join(root, group, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name, dependencies: { [CORE]: "*" } }));
  return dir;
}

afterEach(() => {
  for (const dir of scratch.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("a single @colyseus/core resolution", () => {
  it("installs exactly one copy on disk", () => {
    expect(findCoreCopies(REPO_ROOT)).toHaveLength(1);
  });

  it("resolves to the same copy from every package that depends on Colyseus", () => {
    const consumers = colyseusConsumers(REPO_ROOT);
    expect(consumers.length).toBeGreaterThan(1);
    expect(distinctPaths(resolveCoreFrom(consumers).values())).toHaveLength(1);
  });

  it("sees a nested second copy on disk", () => {
    const root = scratchRepo();
    writeCore(join(root, "node_modules"), "0.18.18");
    writeCore(
      join(root, "packages", "a", "node_modules", "@colyseus", "ws-transport", "node_modules"),
      "0.17.0",
    );
    expect(findCoreCopies(root)).toHaveLength(2);
  });

  it("sees two consumers resolving to different copies", () => {
    const root = scratchRepo();
    writeCore(join(root, "node_modules"), "0.18.18");
    const a = writeConsumer(root, "packages", "a");
    const b = writeConsumer(root, "packages", "b");
    mkdirSync(join(root, "games"));
    writeCore(join(b, "node_modules"), "0.17.0");
    expect(colyseusConsumers(root).sort()).toEqual([a, b].sort());
    expect(distinctPaths(resolveCoreFrom([a, b]).values())).toHaveLength(2);
  });

  it("counts one copy when every consumer shares the hoisted one", () => {
    const root = scratchRepo();
    writeCore(join(root, "node_modules"), "0.18.18");
    const dirs = [writeConsumer(root, "packages", "a"), writeConsumer(root, "games", "b")];
    expect(findCoreCopies(root)).toHaveLength(1);
    expect(distinctPaths(resolveCoreFrom(dirs).values())).toHaveLength(1);
  });
});
