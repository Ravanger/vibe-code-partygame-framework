import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
export interface SymbolInfo {
  experimental?: true;
  undocumented?: true;
  undocumentedMembers?: string[];
}

export interface SubpathEntry {
  target: unknown;
  symbols: Record<string, SymbolInfo>;
  source?: true;
}

export type PackageExports = Record<string, SubpathEntry>;

export interface KnownViolation {
  package: string;
  rule: "types-first" | "src-condition";
  issue: number;
}

export interface Snapshot {
  knownViolations: KnownViolation[];
  packages: Record<string, PackageExports>;
}

const conditionsOf = (target: unknown): [string, unknown][] | undefined =>
  typeof target === "object" && target !== null ? Object.entries(target) : undefined;

const diffSubpath = (label: string, current: SubpathEntry, snapshot: SubpathEntry): string[] => {
  const out: string[] = [];
  if (JSON.stringify(current.target) !== JSON.stringify(snapshot.target)) {
    out.push(`${label} : exports target changed`);
  }
  for (const name of Object.keys(current.symbols)) {
    if (!(name in snapshot.symbols)) out.push(`${label} : symbol added: ${name}`);
    else if (current.symbols[name]?.experimental !== snapshot.symbols[name]?.experimental) {
      out.push(`${label} : experimental changed: ${name}`);
    }
  }
  for (const name of Object.keys(snapshot.symbols)) {
    if (!(name in current.symbols)) out.push(`${label} : symbol removed: ${name}`);
  }
  return out;
};

export const diffSnapshot = (
  current: Record<string, PackageExports>,
  snapshot: Record<string, PackageExports>,
): string[] => {
  const out: string[] = [];
  for (const [pkg, now] of Object.entries(current)) {
    const before = snapshot[pkg];
    if (before === undefined) {
      out.push(`${pkg}: package added`);
      continue;
    }
    for (const [subpath, entry] of Object.entries(now)) {
      const old = before[subpath];
      if (old === undefined) out.push(`${pkg} ${subpath} : subpath added`);
      else out.push(...diffSubpath(`${pkg} ${subpath}`, entry, old));
    }
    for (const subpath of Object.keys(before)) {
      if (!(subpath in now)) out.push(`${pkg} ${subpath} : subpath removed`);
    }
  }
  for (const pkg of Object.keys(snapshot)) {
    if (!(pkg in current)) out.push(`${pkg}: package removed`);
  }
  return out;
};

export const checkConditionOrder = (exportsMap: Record<string, unknown>): string[] =>
  Object.entries(exportsMap)
    .filter(([, target]) => {
      const conditions = conditionsOf(target);
      return conditions !== undefined && conditions[0]?.[0] !== "types";
    })
    .map(([subpath]) => subpath);

export const checkSourceConditions = (entries: PackageExports): string[] =>
  Object.entries(entries)
    .filter(([, entry]) =>
      (conditionsOf(entry.target) ?? []).some(
        ([key, value]) =>
          typeof value === "string" &&
          value.startsWith("./src/") &&
          key !== "svelte" &&
          entry.source !== true,
      ),
    )
    .map(([subpath]) => subpath);

export const undocumentedExports = (current: Record<string, PackageExports>): string[] =>
  Object.entries(current).flatMap(([pkg, entries]) =>
    Object.entries(entries).flatMap(([subpath, entry]) =>
      Object.entries(entry.symbols).flatMap(([name, info]) => [
        ...(info.undocumented ? [`${pkg} ${subpath} : undocumented: ${name}`] : []),
        ...(info.undocumentedMembers ?? []).map(
          (member) => `${pkg} ${subpath} : undocumented: ${name}#${member}`,
        ),
      ]),
    ),
  );

const MESSAGES: Record<KnownViolation["rule"], string> = {
  "types-first": "types must be the first condition",
  "src-condition": "only the svelte condition or a source subpath may point into ./src/",
};

export const checkExports = (
  current: Record<string, PackageExports>,
  snapshot: Snapshot,
): string[] => {
  const out = [...diffSnapshot(current, snapshot.packages), ...undocumentedExports(current)];
  const occurring = new Set<string>();
  for (const [pkg, entries] of Object.entries(current)) {
    const flagged = Object.fromEntries(
      Object.entries(entries).map(([subpath, entry]) => [
        subpath,
        {
          ...entry,
          ...(snapshot.packages[pkg]?.[subpath]?.source ? { source: true as const } : {}),
        },
      ]),
    );
    const found: [KnownViolation["rule"], string[]][] = [
      [
        "types-first",
        checkConditionOrder(
          Object.fromEntries(Object.entries(entries).map(([s, e]) => [s, e.target])),
        ),
      ],
      ["src-condition", checkSourceConditions(flagged)],
    ];
    for (const [rule, subpaths] of found) {
      const known = snapshot.knownViolations.some((v) => v.package === pkg && v.rule === rule);
      if (known && subpaths.length > 0) occurring.add(`${pkg}:${rule}`);
      if (!known) out.push(...subpaths.map((s) => `${pkg} ${s} : ${MESSAGES[rule]}`));
    }
  }
  for (const v of snapshot.knownViolations) {
    if (!occurring.has(`${v.package}:${v.rule}`)) {
      out.push(`${v.package}: known violation ${v.rule} (#${v.issue}) no longer occurs, remove it`);
    }
  }
  return out;
};

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

const hasDocs = (symbol: ts.Symbol, checker: ts.TypeChecker): boolean =>
  symbol.getDocumentationComment(checker).length > 0;

const isPublicMember = (member: ts.Symbol): boolean => {
  const declaration = member.declarations?.[0];
  if (declaration === undefined) return false;
  const kind = declaration.kind;
  if (
    kind !== ts.SyntaxKind.MethodDeclaration &&
    kind !== ts.SyntaxKind.GetAccessor &&
    kind !== ts.SyntaxKind.SetAccessor
  ) {
    return false;
  }
  const flags = ts.getCombinedModifierFlags(declaration as ts.Declaration);
  const hidden = ts.ModifierFlags.Private | ts.ModifierFlags.Protected;
  return (
    (flags & hidden) === 0 &&
    !ts.isPrivateIdentifier((declaration as ts.NamedDeclaration).name as ts.Node)
  );
};

const undocumentedMembersOf = (resolved: ts.Symbol, checker: ts.TypeChecker): string[] => {
  if (!(resolved.flags & ts.SymbolFlags.Class)) return [];
  const members = [
    ...(resolved.members as ts.SymbolTable).values(),
    ...(resolved.exports as ts.SymbolTable).values(),
  ];
  return members
    .filter((member) => isPublicMember(member) && !hasDocs(member, checker))
    .map((member) => member.name)
    .sort();
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
    const undocumentedMembers = undocumentedMembersOf(resolved, checker);
    out[symbol.name] = {
      ...(experimental ? { experimental: true as const } : {}),
      ...(hasDocs(resolved, checker) || hasDocs(symbol, checker)
        ? {}
        : { undocumented: true as const }),
      ...(undocumentedMembers.length > 0 ? { undocumentedMembers } : {}),
    };
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
};

const workspacePaths = (root: string): Record<string, string[]> => {
  const paths: Record<string, string[]> = {};
  for (const dir of readdirSync(join(root, "packages")).sort()) {
    const pkgDir = join(root, "packages", dir);
    const manifestPath = join(pkgDir, "package.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      name?: string;
      exports?: Record<string, unknown>;
    };
    for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
      const file = sourceFor(pkgDir, pickTarget(target));
      if (manifest.name !== undefined && file !== undefined) {
        paths[`${manifest.name}${subpath.slice(1)}`] = [file];
      }
    }
  }
  return paths;
};

const baseOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
  skipLibCheck: true,
  noEmit: true,
};

export const buildCurrent = (root: string, previous: Snapshot): Record<string, PackageExports> => {
  const current: Record<string, PackageExports> = {};
  const paths = workspacePaths(root);
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
    const program = ts.createProgram(files, { ...baseOptions, paths });
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
