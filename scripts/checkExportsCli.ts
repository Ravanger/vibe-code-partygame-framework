import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { checkExports, type PackageExports, type Snapshot } from "./checkExports.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const snapshotPath = join(root, "scripts", "exports.snapshot.json");

const pickTarget = (target: unknown): string | undefined => {
  if (typeof target === "string") return target;
  if (typeof target !== "object" || target === null) return undefined;
  const conditions = target as Record<string, unknown>;
  const picked = conditions.svelte ?? conditions.default ?? conditions.import ?? conditions.types;
  return typeof picked === "string" ? picked : undefined;
};

const sourceFor = (pkgDir: string, target: string | undefined): string | undefined => {
  if (target === undefined) return undefined;
  const mapped = target.startsWith("./dist/")
    ? `./src/${target.slice("./dist/".length)}`.replace(/\.(d\.ts|js)$/, ".ts")
    : target;
  const path = join(pkgDir, mapped);
  return /\.ts$/.test(path) && existsSync(path) ? path : undefined;
};

const symbolsOf = (program: ts.Program, file: string): PackageExports[string]["symbols"] => {
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(file);
  const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile);
  const out: PackageExports[string]["symbols"] = {};
  for (const symbol of moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : []) {
    const resolved =
      symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const experimental = [...symbol.getJsDocTags(checker), ...resolved.getJsDocTags(checker)].some(
      (tag) => tag.name === "experimental",
    );
    out[symbol.name] = experimental ? { experimental: true } : {};
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
};

const options: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
  skipLibCheck: true,
  noEmit: true,
};

const buildCurrent = (previous: Snapshot): Record<string, PackageExports> => {
  const current: Record<string, PackageExports> = {};
  for (const dir of readdirSync(join(root, "packages")).sort()) {
    const pkgDir = join(root, "packages", dir);
    const manifestPath = join(pkgDir, "package.json");
    if (!existsSync(manifestPath)) continue;
    const exportsMap = JSON.parse(readFileSync(manifestPath, "utf8")).exports as
      | Record<string, unknown>
      | undefined;
    if (exportsMap === undefined) continue;
    const sources = Object.entries(exportsMap)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(
        ([subpath, target]) => [subpath, target, sourceFor(pkgDir, pickTarget(target))] as const,
      );
    const files = sources.flatMap(([, , file]) => (file ? [file] : []));
    const program = ts.createProgram(files, options);
    const entries: PackageExports = {};
    for (const [subpath, target, file] of sources) {
      const flag = previous.packages[dir]?.[subpath]?.source;
      entries[subpath] = {
        target,
        symbols: file ? symbolsOf(program, file) : {},
        ...(flag ? { source: true as const } : {}),
      };
    }
    current[dir] = entries;
  }
  return current;
};

const previous: Snapshot = existsSync(snapshotPath)
  ? JSON.parse(readFileSync(snapshotPath, "utf8"))
  : { knownViolations: [], packages: {} };
const current = buildCurrent(previous);

if (process.argv.includes("--update")) {
  const next: Snapshot = { knownViolations: previous.knownViolations, packages: current };
  writeFileSync(snapshotPath, `${JSON.stringify(next, null, 2)}\n`);
  process.exit(0);
}

const problems = checkExports(current, previous);
for (const problem of problems) console.error(problem);
process.exit(problems.length === 0 ? 0 : 1);
