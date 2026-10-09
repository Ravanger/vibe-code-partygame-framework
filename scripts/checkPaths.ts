export interface Change {
  path: string;
  status: "A" | "M" | "D" | "R";
}

export interface Violation {
  path: string;
  message: string;
}

const GENERATED = ["dist", "coverage", "node_modules", ".turbo"];

const generatedDir = (path: string): string | undefined =>
  path.split("/").find((segment) => GENERATED.includes(segment));

const isPackageJson = (path: string): boolean =>
  path === "package.json" || path.endsWith("/package.json");

export const parseNameStatus = (output: string): Change[] =>
  output
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => ({
      status: line.charAt(0) as Change["status"],
      path: line.slice(line.lastIndexOf("\t") + 1),
    }));

export const checkPaths = (changes: Change[]): Violation[] => {
  const lockAllowed = changes.some((c) => isPackageJson(c.path));
  const violations: Violation[] = [];
  for (const { path } of changes) {
    const dir = generatedDir(path);
    if (dir) {
      violations.push({ path, message: `generated directory ${dir}/ must not be edited` });
    } else if (path === "bun.lock" && !lockAllowed) {
      violations.push({ path, message: "bun.lock changed without a package.json change" });
    }
  }
  return violations;
};
