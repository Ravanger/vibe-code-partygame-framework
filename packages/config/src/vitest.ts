import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { mergeConfig, type ViteUserConfig } from "vitest/config";

export interface TestPresetOptions {
  name: string;
  coverage: string[];
  include?: string[];
  exclude?: string[];
  setupFiles?: string[];
  overrides?: ViteUserConfig;
}

const DEFAULT_UI_SETUP = ["@testing-library/jest-dom/vitest", "@partygame/game-client/test-setup"];
const DEFAULT_NODE_SETUP = ["@partygame/config/node-test-setup"];

/** `packages/` — one level above both `src/` and `dist/`, so the same relative path works from source and from the shipped preset. */
const PACKAGES_DIR = fileURLToPath(new URL("../..", import.meta.url));

interface PackageManifest {
  name?: string;
  exports?: Record<string, string | Record<string, string>>;
}

/** The package-relative source file an export target points to: `./dist/x.js` becomes `src/x.ts`; an existing `.ts` path passes through; anything else (a `.json` preset) has no source alias. */
function sourceFor(target: string): string | undefined {
  if (target.startsWith("./dist/"))
    return `src/${target.slice("./dist/".length).replace(/\.js$/, ".ts")}`;
  if (target.startsWith("./") && target.endsWith(".ts")) return target.slice(2);
  return undefined;
}

interface AliasEntry {
  key: string;
  source: string;
  dist: string;
}

function aliasEntries(packagesDir: string): AliasEntry[] {
  const entries: AliasEntry[] = [];
  for (const name of readdirSync(packagesDir)) {
    let manifest: PackageManifest;
    try {
      manifest = JSON.parse(
        readFileSync(join(packagesDir, name, "package.json"), "utf8"),
      ) as PackageManifest;
    } catch {
      continue; // A file, or a directory without a manifest — not a package.
    }
    if (!manifest.name?.startsWith("@partygame/")) continue;
    for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
      const value =
        typeof target === "string" ? target : (target.svelte ?? target.default ?? target.import);
      if (typeof value !== "string") continue;
      const source = sourceFor(value);
      if (source === undefined) continue;
      entries.push({
        key: `${manifest.name}${subpath === "." ? "" : subpath.replace(/^\./, "")}`,
        source: join(packagesDir, name, source),
        dist: join(packagesDir, name, value.slice(2)),
      });
    }
  }
  // Subpaths before their parent: alias matching is prefix-based, so `@partygame/core` would
  // otherwise shadow `@partygame/core/testing`.
  entries.sort((a, b) => b.key.length - a.key.length);
  return entries;
}

/**
 * Maps every `@partygame/*` export subpath to its package source, so a test in one workspace never
 * reads another's stale `dist/` build. Both presets install this as `resolve.alias`; real consumers
 * (launcher, dev server) still resolve through `dist/` as usual.
 */
export function sourceAliases(packagesDir: string = PACKAGES_DIR): Record<string, string> {
  return Object.fromEntries(aliasEntries(packagesDir).map(({ key, source }) => [key, source]));
}

/**
 * Subpaths whose source graph value-imports node: builtins. jsdom projects transform modules with
 * Vite's client pipeline, which rewrites those imports as CJS interop; remapped through source
 * maps, their v8 coverage items don't line up with the SSR-transformed ones from node projects
 * (the provider merges per-project maps by source location), leaving phantom uncovered statements.
 * The UI preset resolves these subpaths to dist instead: UI tests need a working test server, not
 * fresh source, and the owning project's own tests cover the source.
 */
const JSDOM_DIST_ONLY = ["@partygame/server/node", "@partygame/server/testing"];

function shared(options: TestPresetOptions, environment: "jsdom" | "node"): ViteUserConfig {
  const alias: Record<string, string> = {};
  for (const entry of aliasEntries(PACKAGES_DIR)) {
    alias[entry.key] =
      environment === "jsdom" && JSDOM_DIST_ONLY.includes(entry.key) ? entry.dist : entry.source;
  }
  return {
    resolve: { alias },
    test: {
      name: options.name,
      environment,
      include: options.include ?? ["tests/**/*.test.ts"],
      exclude: ["dist/**", "node_modules/**", "coverage/**", ...(options.exclude ?? [])],
      fileParallelism: false,
      coverage: { include: options.coverage },
    },
  };
}

/** Vitest project config for jsdom + Svelte tests. */
export function uiTestConfig(options: TestPresetOptions): ViteUserConfig {
  return mergeConfig(
    mergeConfig(shared(options, "jsdom"), {
      plugins: [svelte({ emitCss: false })],
      resolve: { conditions: ["browser"] },
      test: { globals: true, setupFiles: options.setupFiles ?? DEFAULT_UI_SETUP },
    }),
    options.overrides ?? {},
  );
}

/** Vitest project config for node tests. */
export function nodeTestConfig(options: TestPresetOptions): ViteUserConfig {
  return mergeConfig(
    mergeConfig(shared(options, "node"), {
      // The shared preset aliases @partygame/* to source, so node tests can load a package's
      // .svelte.ts files (e.g. GameConnectionManager via game-client/testing). Compile them
      // with the same svelte transform as the UI projects: v8 coverage merges per-project maps
      // by source location, and a plain-TS transform of runes leaves phantom uncovered items.
      plugins: [svelte({ emitCss: false })],
      test: { setupFiles: options.setupFiles ?? DEFAULT_NODE_SETUP },
    }),
    options.overrides ?? {},
  );
}
