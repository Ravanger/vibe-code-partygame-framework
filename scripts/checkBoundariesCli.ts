import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { checkBoundaries, importsOf, type SourceFile, type Workspace } from "./checkBoundaries.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const SOURCE_DIRS = ["src", "tests", "ui", "bots", "terminal"];
const SOURCE = /\.(ts|svelte)$/;
const SKIPPED = new Set(["node_modules", "dist", "coverage"]);

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED.has(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return SOURCE.test(entry.name) ? [path] : [];
  });

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const names = (record: unknown): string[] =>
  typeof record === "object" && record !== null ? Object.keys(record) : [];

const readWorkspace = (dir: string): Workspace | undefined => {
  let manifest: {
    name?: string;
    dependencies?: unknown;
    devDependencies?: unknown;
    exports?: unknown;
  };
  try {
    manifest = JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8"));
  } catch {
    return undefined;
  }
  const files: SourceFile[] = SOURCE_DIRS.map((sub) => join(root, dir, sub))
    .filter(isDirectory)
    .flatMap(walk)
    .map((path) => ({
      path: relative(root, path).replaceAll("\\", "/"),
      imports: importsOf(readFileSync(path, "utf8")),
    }));
  return {
    dir,
    name: manifest.name ?? dir,
    dependencies: names(manifest.dependencies),
    devDependencies: names(manifest.devDependencies),
    exports: names(manifest.exports),
    files,
  };
};

const workspaces = ["packages", "games"]
  .flatMap((parent) =>
    readdirSync(join(root, parent), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => readWorkspace(`${parent}/${entry.name}`)),
  )
  .filter((workspace): workspace is Workspace => workspace !== undefined);

const violations = checkBoundaries(workspaces);
for (const violation of violations) {
  console.error(`${violation.path}: ${violation.rule}: ${violation.detail}`);
}
process.exit(violations.length === 0 ? 0 : 1);
