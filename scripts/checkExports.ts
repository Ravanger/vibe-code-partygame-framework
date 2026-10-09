export interface SymbolInfo {
  experimental?: true;
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

const MESSAGES: Record<KnownViolation["rule"], string> = {
  "types-first": "types must be the first condition",
  "src-condition": "only the svelte condition or a source subpath may point into ./src/",
};

export const checkExports = (
  current: Record<string, PackageExports>,
  snapshot: Snapshot,
): string[] => {
  const out = diffSnapshot(current, snapshot.packages);
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
