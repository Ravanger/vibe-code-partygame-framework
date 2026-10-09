export const OVERRIDE_LABEL = "gate-change";

export interface GateViolation {
  path: string;
  rule: string;
  detail: string;
}

const PROTECTED_PATHS = [/^\.github\/workflows\//, /^scripts\/check[^/]*\.ts$/, /^lefthook\.yml$/];

const FORBIDDEN_LINES: { rule: string; pattern: RegExp }[] = [
  { rule: "suppression", pattern: /biome-ignore/ },
  { rule: "suppression", pattern: /@ts-ignore/ },
  { rule: "suppression", pattern: /@ts-expect-error/ },
  { rule: "suppression", pattern: /eslint-disable/ },
  { rule: "focused-or-skipped-test", pattern: /\.(skip|only)\(/ },
  { rule: "type-escape", pattern: /\bas any\b/ },
  { rule: "type-escape", pattern: /\bas unknown as\b/ },
];

const THRESHOLD = /\b(lines|functions|branches|statements)\s*:\s*(\d+(?:\.\d+)?)/g;
const EXCLUDE_ENTRY = /^\s*"[^"]+",?\s*$/;
const SEVERITY = /"(off|warn|info|on)"/;

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

const thresholdsOf = (lines: string[]): Map<string, number> => {
  const found = new Map<string, number>();
  for (const line of lines) {
    for (const match of line.matchAll(THRESHOLD)) found.set(match[1] as string, Number(match[2]));
  }
  return found;
};

const loweredThresholds = (change: FileChange): GateViolation[] => {
  const before = thresholdsOf(change.removed);
  const after = thresholdsOf(change.added);
  const violations: GateViolation[] = [];
  for (const [key, old] of before) {
    const next = after.get(key);
    if (next === undefined || next < old) {
      violations.push({
        path: change.path,
        rule: "threshold",
        detail: `${key} threshold lowered from ${old} to ${next ?? "nothing"}`,
      });
    }
  }
  return violations;
};

const addedExcludes = (change: FileChange): GateViolation[] =>
  change.added
    .filter((line) => EXCLUDE_ENTRY.test(line))
    .map((line) => ({
      path: change.path,
      rule: "coverage-exclude",
      detail: `coverage exclude added: ${line.trim()}`,
    }));

const severityChanges = (change: FileChange): GateViolation[] =>
  change.added
    .filter((line) => SEVERITY.test(line))
    .map((line) => ({
      path: change.path,
      rule: "severity",
      detail: `biome rule severity relaxed: ${line.trim()}`,
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
  if (change.path === "vitest.config.mts")
    violations.push(...loweredThresholds(change), ...addedExcludes(change));
  if (change.path === "biome.json") violations.push(...severityChanges(change));
  return violations;
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

export const checkGates = (diff: string, labels: string[]): GateViolation[] =>
  labels.includes(OVERRIDE_LABEL) ? [] : parseDiff(diff).flatMap(violationsOf);
