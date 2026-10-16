import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// The vitest projects that exist regardless of which games are scaffolded.
const FIXED_PROJECTS = ["cli", "scripts"];

interface Manifest {
  name?: unknown;
}

/** Parses a workspace `package.json`; undefined when the folder has none or it is not an object. */
async function readManifest(path: string): Promise<Manifest | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    return typeof parsed === "object" && parsed !== null ? (parsed as Manifest) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Checks a validated slug against the workspaces of `root`. Returns an error message when the
 * package name `@partygame/<slug>` already exists, when `<slug>` or `<slug>-game` is (or would be)
 * a vitest project name of an existing game, or when it collides with a fixed project name;
 * otherwise undefined. Folders without a valid `package.json` are skipped.
 */
export async function findCollision(root: string, slug: string): Promise<string | undefined> {
  const packageNames = new Set<string>();
  const gameFolders = new Set<string>();
  for (const area of ["packages", "games"] as const) {
    let entries: string[];
    try {
      entries = await readdir(join(root, area));
    } catch {
      continue; // The area does not exist in this repo — nothing to collide with.
    }
    for (const folder of entries) {
      const manifest = await readManifest(join(root, area, folder, "package.json"));
      if (manifest === undefined) continue;
      if (typeof manifest.name === "string") packageNames.add(manifest.name);
      if (area === "games") gameFolders.add(folder);
    }
  }

  const packageName = `@partygame/${slug}`;
  if (packageNames.has(packageName)) {
    return `"${slug}" is taken: the package "${packageName}" already exists`;
  }
  for (const folder of gameFolders) {
    if (slug === folder || slug === `${folder}-game`) {
      return `"${slug}" is taken: it is a vitest project name of the existing game "${folder}"`;
    }
    if (`${slug}-game` === folder) {
      const project = `${slug}-game`;
      return `"${slug}" is taken: its vitest project "${project}" collides with game "${folder}"`;
    }
  }
  for (const fixed of FIXED_PROJECTS) {
    if (slug === fixed || `${slug}-game` === fixed) {
      return `"${slug}" is taken: it collides with the fixed vitest project "${fixed}"`;
    }
  }
  return undefined;
}
