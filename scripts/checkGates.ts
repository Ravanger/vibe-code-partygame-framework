export const OVERRIDE_LABEL = "gate-change";
export const NO_TEST_LABEL = "no-test-needed";

export interface GateViolation {
  path: string;
  rule: string;
  detail: string;
}

const PROTECTED_PATHS = [
  /^\.github\/(workflows|actions)\//,
  /^scripts\/(check|mutateChanged)[^/]*\.ts$/,
  /^lefthook\.yml$/,
  /^scripts\/stryker\.config\.json$/,
  /^biome\.json$/,
  /^biome-plugins\//,
  /^knip\.json$/,
  /^vitest\.config\.mts$/,
  /^scripts\/bundleSize[^/]*\.ts$/,
  /^scripts\/(bundle-budget|exports\.snapshot)\.json$/,
  /^scripts\/(vitest\.config\.ts|tsconfig\.json)$/,
  /^(turbo|tsconfig\.base)\.json$/,
  /^packages\/config\/(src\/vitest\.ts|tsconfig\.(base|game)\.json|node-test-setup\.ts)$/,
];

const FORBIDDEN_LINES: { rule: string; pattern: RegExp }[] = [
  { rule: "suppression", pattern: /biome-ignore/ },
  { rule: "suppression", pattern: /@ts-ignore/ },
  { rule: "suppression", pattern: /@ts-expect-error/ },
  { rule: "suppression", pattern: /eslint-disable/ },
  { rule: "suppression", pattern: /Stryker disable/ },
  { rule: "suppression", pattern: /\b(v8|c8|istanbul) ignore\b/ },
  { rule: "suppression", pattern: /@ts-nocheck/ },
  { rule: "focused-or-skipped-test", pattern: /\.(skip|only|skipIf|runIf|todo|fails)\b\s*[.(]/ },
  { rule: "focused-or-skipped-test", pattern: /\b(xit|xdescribe|xtest)\(/ },
  { rule: "type-escape", pattern: /\bas any\b/ },
  { rule: "type-escape", pattern: /\bas unknown as\b/ },
];

const GATE_SCRIPT =
  /^\s*"((lint|verify|typecheck|test|smoke)(:[\w:-]+)?|(check|mutate):[\w:-]+)"\s*:/;
const RELAXED_FLAG =
  /"(strict|noUnchecked|noImplicit|noUnused|noFallthrough|exactOptional)\w*"\s*:\s*false/;
const DROPPED_FLAG =
  /"(strict|noUnchecked|noImplicit|noUnused|noFallthrough|exactOptional)\w*"\s*:\s*true/;

interface FileChange {
  path: string;
  added: string[];
  removed: string[];
  removedKeys: (string | undefined)[];
}

const ARRAY_OPEN = /^\s*"([^"]+)"\s*:\s*\[\s*$/;

export const parseDiff = (diff: string): FileChange[] => {
  const changes: FileChange[] = [];
  let current: FileChange | undefined;
  let inHunk = false;
  let arrayKey: string | undefined;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      current = {
        path: line.slice(line.lastIndexOf(" b/") + 3),
        added: [],
        removed: [],
        removedKeys: [],
      };
      changes.push(current);
      inHunk = false;
    } else if (line.startsWith("@@")) {
      inHunk = true;
      arrayKey = undefined;
    } else if (current && inHunk) {
      if (line.startsWith("+")) {
        current.added.push(line.slice(1));
        continue;
      }
      const old = line.slice(1);
      const opened = ARRAY_OPEN.exec(old);
      if (opened) arrayKey = opened[1];
      if (line.startsWith("-")) {
        current.removed.push(old);
        current.removedKeys.push(arrayKey);
      }
      if (/^\s*\]/.test(old)) arrayKey = undefined;
    }
  }
  return changes;
};

const scriptEntry = (line: string): string => line.trim().replace(/,$/, "");

const changedGateScripts = (change: FileChange): GateViolation[] => {
  const kept = new Set(change.added.map(scriptEntry));
  return change.removed
    .filter((line) => GATE_SCRIPT.test(line) && !kept.has(scriptEntry(line)))
    .map((line) => ({
      path: change.path,
      rule: "gate-script",
      detail: `gate script changed: ${line.trim()}`,
    }));
};

const quoted = (line: string): string[] =>
  Array.from(line.matchAll(/"([^"]*)"/g), (match) => match[1] as string);

const BARE_ENTRY = /^\s*"[^"]*",?\s*$/;

const narrowedScope = (change: FileChange): GateViolation[] => {
  const kept = new Set(change.added.flatMap(quoted));
  const shrunk = change.removed
    .filter(
      (line, index) =>
        /"include"\s*:/.test(line) ||
        (BARE_ENTRY.test(line) && [undefined, "include"].includes(change.removedKeys[index])),
    )
    .filter((line) => quoted(line).some((entry) => !kept.has(entry)));
  return [
    ...shrunk.map((line) => `tsconfig include shrunk: ${line.trim()}`),
    ...change.added
      .filter((line) => /"exclude"\s*:/.test(line))
      .map((line) => `tsconfig exclude added: ${line.trim()}`),
  ].map((detail) => ({ path: change.path, rule: "tsconfig-scope", detail }));
};

const relaxedCompilerOptions = (change: FileChange): GateViolation[] =>
  [
    ...change.added.filter((line) => RELAXED_FLAG.test(line)),
    ...change.removed.filter((line) => DROPPED_FLAG.test(line)),
  ].map((line) => ({
    path: change.path,
    rule: "compiler-option",
    detail: `compiler check relaxed: ${line.trim()}`,
  }));

/** Maintainer-approved additions: an explicit per-file exception for one exact line, never a general exemption. */
const APPROVED_LINES: { path: string; pattern: RegExp }[] = [
  // #129: the symlink test bails out where the OS forbids creating symlinks (Windows without privilege).
  {
    path: "packages/content/tests/content.test.ts",
    pattern: /ctx\.skip\("symlinks not permitted on this machine"\)/,
  },
];

const isApprovedLine = (path: string, line: string): boolean =>
  APPROVED_LINES.some(
    ({ path: approvedPath, pattern }) => approvedPath === path && pattern.test(line),
  );

const forbiddenAdditions = (change: FileChange): GateViolation[] =>
  change.added.flatMap((line) =>
    FORBIDDEN_LINES.filter(
      ({ pattern }) => pattern.test(line) && !isApprovedLine(change.path, line),
    ).map(({ rule }) => ({
      path: change.path,
      rule,
      detail: line.trim(),
    })),
  );

const violationsOf = (change: FileChange): GateViolation[] => {
  const violations = forbiddenAdditions(change);
  if (PROTECTED_PATHS.some((pattern) => pattern.test(change.path))) {
    violations.push({ path: change.path, rule: "protected-path", detail: "gate file edited" });
  }
  if (/(^|\/)package\.json$/.test(change.path)) violations.push(...changedGateScripts(change));
  if (/(^|\/)tsconfig[^/]*\.json$/.test(change.path))
    violations.push(...relaxedCompilerOptions(change), ...narrowedScope(change));
  return violations;
};

const SOURCE_FILE = /^((?:packages|games)\/[^/]+)\/src\/.+/;
const GAME_SOURCE_FILE = /^(games\/[^/]+)\/(?:(?:ui|bots|terminal)\/.+\.ts|gamePackage\.ts)$/;
const ENTRY_STUB = /^games\/[^/]+\/(?:ui\/main|bots\/cli|terminal\/(?:play|demo))\.ts$/;
const TEST_FILE = /^((?:packages|games)\/[^/]+)\/.+\.test\.ts$/;

const untestedChanges = (changes: FileChange[]): GateViolation[] => {
  const touched = changes.filter((change) => change.added.length > 0 || change.removed.length > 0);
  const tested = new Set(touched.map(({ path }) => TEST_FILE.exec(path)?.[1]));
  const roots = new Set(
    touched
      .filter(({ path, added }) => added.length > 0 && !path.endsWith(".d.ts"))
      .filter(({ path }) => !TEST_FILE.test(path))
      .filter(({ path }) => !ENTRY_STUB.test(path))
      .flatMap(({ path }) => (SOURCE_FILE.exec(path) ?? GAME_SOURCE_FILE.exec(path))?.[1] ?? []),
  );
  return [...roots]
    .filter((root) => !tested.has(root))
    .map((root) => ({
      path: root,
      rule: "untested-change",
      detail: "src changed without a *.test.ts change",
    }));
};

export const labelsOf = (event: unknown): string[] => {
  if (typeof event !== "object" || event === null) return [];
  const pullRequest = (event as { pull_request?: { labels?: unknown } }).pull_request;
  if (!Array.isArray(pullRequest?.labels)) return [];
  return pullRequest.labels.flatMap((label: unknown) => {
    const name = (label as { name?: unknown } | null)?.name;
    return typeof name === "string" ? [name] : [];
  });
};

const labelEvents = (events: unknown): unknown[] => (Array.isArray(events) ? events.flat() : []);

/** Labels whose latest labeled/unlabeled issue event is an add by `owner`. */
export const ownerLabels = (events: unknown, owner: string): string[] => {
  const latest = new Map<string, boolean>();
  for (const entry of labelEvents(events)) {
    const { event, label, actor } = (entry ?? {}) as {
      event?: unknown;
      label?: { name?: unknown };
      actor?: { login?: unknown };
    };
    if ((event === "labeled" || event === "unlabeled") && typeof label?.name === "string") {
      latest.set(label.name, event === "labeled" && actor?.login === owner);
    }
  }
  return [...latest].filter(([, byOwner]) => byOwner).map(([name]) => name);
};

export const trustedLabels = (event: unknown, events: unknown, owner: string): string[] => {
  const byOwner = new Set(ownerLabels(events, owner));
  return labelsOf(event).filter((name) => byOwner.has(name));
};

export const diffRange = (args: string[]): string[] => {
  if (args.includes("--staged")) return ["--cached"];
  const flag = args.indexOf("--base");
  return [`${(flag === -1 ? undefined : args[flag + 1]) ?? "origin/main"}...HEAD`];
};

export const checkGates = (
  diff: string,
  labels: string[],
  requireTests = false,
): GateViolation[] => {
  const changes = parseDiff(diff);
  const gated = labels.includes(OVERRIDE_LABEL) ? [] : changes.flatMap(violationsOf);
  const untested = requireTests && !labels.includes(NO_TEST_LABEL) ? untestedChanges(changes) : [];
  return [...gated, ...untested];
};

export interface TreeFile {
  path: string;
  content: string;
}

/** Suppressions already on main, each tied to one file and one exact line shape. */
export const TREE_ALLOWLIST: { path: string; pattern: RegExp; reason: string }[] = [
  {
    path: "packages/content/tests/content.test.ts",
    pattern: /ctx\.skip\("symlinks not permitted on this machine"\)/,
    reason: "#129: bails out where the OS forbids creating symlinks",
  },
  {
    path: "packages/core/tests/runtime/types.test.ts",
    pattern: /@ts-expect-error the handler cannot read a field the schema does not declare/,
    reason: "a type test asserting that an invalid handler fails to compile",
  },
  {
    path: "packages/game-ui/src/components/GameControls.svelte",
    pattern: /biome-ignore lint\/correctness\/noUnusedImports: used by the generics attribute/,
    reason: "Svelte generics= trap (docs/framework/troubleshooting.md)",
  },
  {
    path: "packages/game-ui/src/components/LobbySettings.svelte",
    pattern: /biome-ignore lint\/correctness\/noUnusedImports: used by the generics attribute/,
    reason: "Svelte generics= trap (docs/framework/troubleshooting.md)",
  },
  {
    path: "packages/game-ui/src/components/Podium.svelte",
    pattern: /biome-ignore lint\/correctness\/noUnusedImports: used by the generics attribute/,
    reason: "Svelte generics= trap (docs/framework/troubleshooting.md)",
  },
  {
    path: "packages/server/src/bun.ts",
    pattern: /@ts-expect-error - Bun ships no TypeScript declarations in this repo/,
    reason: "Bun ships no TypeScript declarations here",
  },
];

const TREE_RULES = new Set(["suppression", "focused-or-skipped-test"]);

/** The gate's own regex text and tests would match themselves. */
export const isScannedPath = (path: string): boolean =>
  /\.(ts|mts|js|mjs|cjs|tsx|svelte)$/.test(path) && !/^scripts\/checkGates[^/]*$/.test(path);

export const scanTree = (
  files: TreeFile[],
  allowlist: { path: string; pattern: RegExp }[] = TREE_ALLOWLIST,
): GateViolation[] =>
  files.flatMap(({ path, content }) =>
    content.split(/\r?\n/).flatMap((line) =>
      FORBIDDEN_LINES.filter(({ rule, pattern }) => TREE_RULES.has(rule) && pattern.test(line))
        .filter(() => !allowlist.some((entry) => entry.path === path && entry.pattern.test(line)))
        .map(({ rule }) => ({ path, rule, detail: line.trim() })),
    ),
  );
