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
];

const FORBIDDEN_LINES: { rule: string; pattern: RegExp }[] = [
  { rule: "suppression", pattern: /biome-ignore/ },
  { rule: "suppression", pattern: /@ts-ignore/ },
  { rule: "suppression", pattern: /@ts-expect-error/ },
  { rule: "suppression", pattern: /eslint-disable/ },
  { rule: "suppression", pattern: /Stryker disable/ },
  { rule: "suppression", pattern: /\b(v8|c8|istanbul) ignore\b/ },
  { rule: "suppression", pattern: /@ts-nocheck/ },
  { rule: "focused-or-skipped-test", pattern: /\.(skip|only|skipIf|runIf|todo)\(/ },
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
}

export const parseDiff = (diff: string): FileChange[] => {
  const changes: FileChange[] = [];
  let current: FileChange | undefined;
  let inHunk = false;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      current = { path: line.slice(line.lastIndexOf(" b/") + 3), added: [], removed: [] };
      changes.push(current);
      inHunk = false;
    } else if (line.startsWith("@@")) {
      inHunk = true;
    } else if (current && inHunk) {
      if (line.startsWith("+")) current.added.push(line.slice(1));
      else if (line.startsWith("-")) current.removed.push(line.slice(1));
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

const relaxedCompilerOptions = (change: FileChange): GateViolation[] =>
  [
    ...change.added.filter((line) => RELAXED_FLAG.test(line)),
    ...change.removed.filter((line) => DROPPED_FLAG.test(line)),
  ].map((line) => ({
    path: change.path,
    rule: "compiler-option",
    detail: `compiler check relaxed: ${line.trim()}`,
  }));

const forbiddenAdditions = (change: FileChange): GateViolation[] =>
  change.added.flatMap((line) =>
    FORBIDDEN_LINES.filter(({ pattern }) => pattern.test(line)).map(({ rule }) => ({
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
    violations.push(...relaxedCompilerOptions(change));
  return violations;
};

const SOURCE_FILE = /^((?:packages|games)\/[^/]+)\/src\/.+/;
const TEST_FILE = /^((?:packages|games)\/[^/]+)\/.+\.test\.ts$/;

const untestedChanges = (changes: FileChange[]): GateViolation[] => {
  const touched = changes.filter((change) => change.added.length > 0 || change.removed.length > 0);
  const tested = new Set(touched.map(({ path }) => TEST_FILE.exec(path)?.[1]));
  const roots = new Set(
    touched
      .filter(({ path, added }) => added.length > 0 && !path.endsWith(".d.ts"))
      .filter(({ path }) => !TEST_FILE.test(path))
      .flatMap(({ path }) => SOURCE_FILE.exec(path)?.[1] ?? []),
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
