import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

interface PackageJson {
  workspaces?: unknown;
}

/**
 * Walks up from `startDir` to the nearest directory whose `package.json` lists `games/*` in its
 * `workspaces`. That is the monorepo root this CLI scaffolds into. Throws when none is found.
 */
export async function findRepoRoot(startDir: string): Promise<string> {
  let dir = startDir;
  for (;;) {
    if (await isMonorepoRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `no monorepo root found above ${startDir} (a package.json with "games/*" in workspaces)`,
  );
}

async function isMonorepoRoot(dir: string): Promise<boolean> {
  let raw: string;
  try {
    raw = await readFile(join(dir, "package.json"), "utf8");
  } catch {
    return false;
  }
  const pkg = JSON.parse(raw) as PackageJson;
  return Array.isArray(pkg.workspaces) && pkg.workspaces.includes("games/*");
}
