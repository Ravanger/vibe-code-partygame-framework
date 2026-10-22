import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

type ExportTarget = string | Record<string, string>;

interface Manifest {
  main?: string;
  types?: string;
  exports?: Record<string, ExportTarget>;
}

function workspacePackages(): string[] {
  const found: string[] = [];
  for (const group of ["packages", "games"] as const) {
    const base = join(root, group);
    if (!existsSync(base)) continue;
    for (const dir of readdirSync(base)) {
      if (existsSync(join(base, dir, "package.json"))) found.push(`${group}/${dir}`);
    }
  }
  return found;
}

function hasSvelteSource(packageDir: string): boolean {
  const src = join(root, packageDir, "src");
  if (!existsSync(src)) return false;
  const walk = (dir: string): boolean => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (walk(full)) return true;
      } else if (entry.name.endsWith(".svelte") || entry.name.endsWith(".svelte.ts")) {
        return true;
      }
    }
    return false;
  };
  return walk(src);
}

function distTargets(manifest: Manifest): string[] {
  const offenders: string[] = [];
  for (const field of ["main", "types"] as const) {
    if (manifest[field]?.startsWith("./dist/")) offenders.push(`${field} -> ${manifest[field]}`);
  }
  for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
    if (typeof target === "string") {
      if (target.startsWith("./dist/")) offenders.push(`exports "${subpath}" -> ${target}`);
    } else {
      for (const condition of ["types", "import", "default"] as const) {
        const value = target[condition];
        if (typeof value === "string" && value.startsWith("./dist/")) {
          offenders.push(`exports "${subpath}" ${condition} -> ${value}`);
        }
      }
    }
  }
  return offenders;
}

describe("Svelte packages ship source only", () => {
  it("no Svelte package resolves a dist file through exports, main or types", () => {
    const offenders: string[] = [];
    for (const packageDir of workspacePackages()) {
      if (!hasSvelteSource(packageDir)) continue;
      const manifest = JSON.parse(
        readFileSync(join(root, packageDir, "package.json"), "utf8"),
      ) as Manifest;
      for (const offender of distTargets(manifest)) offenders.push(`${packageDir}: ${offender}`);
    }
    expect(offenders).toEqual([]);
  });
});
