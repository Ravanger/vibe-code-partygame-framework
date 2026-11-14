import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { findCollision } from "./collisions.js";
import { findRepoRoot } from "./repoRoot.js";
import { deriveNames, type Names, parseSlug } from "./slug.js";
import { renderTemplate } from "./template.js";

export type CreateArgs =
  | { ok: true; slug: string; name?: string; headless?: boolean }
  | { ok: false; error: string };

const USAGE = 'Usage: partygame create <slug> [--name "Display Name"] [--headless]';

/** Parses `create <slug> [--name "..." | --name=...] [--headless]`; a usage error otherwise. */
export function parseCreateArgs(argv: string[]): CreateArgs {
  const [first, ...rest] = argv;
  if (first === undefined) return { ok: false, error: USAGE };
  let name: string | undefined;
  let headless = false;
  const args = rest[Symbol.iterator]();
  for (const arg of args) {
    if (arg === "--headless") {
      headless = true;
      continue;
    }
    let value: string | undefined;
    if (arg === "--name") {
      const next = args.next().value;
      if (next === undefined) return { ok: false, error: USAGE };
      value = next;
    } else if (arg.startsWith("--name=")) {
      value = arg.slice("--name=".length);
    } else {
      return { ok: false, error: `unexpected argument "${arg}"\n${USAGE}` };
    }
    name = value.trim();
    if (name.length === 0) return { ok: false, error: `--name must not be empty\n${USAGE}` };
  }
  const slug = parseSlug(first);
  if (!slug.ok) return { ok: false, error: slug.error };
  return {
    ok: true,
    slug: slug.slug,
    ...(name === undefined ? {} : { name }),
    ...(headless ? { headless } : {}),
  };
}

/** The message of an `Error`, or its string form. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface RunCreateOptions {
  slug: string;
  name?: string;
  /** Scaffolds the headless shape: rules, bots and terminal only, no browser UI. */
  headless?: boolean;
  /** Where to start looking for the repo root (usually `process.cwd()`). */
  cwd: string;
  /** Directory of the template files. */
  templateDir: string;
  /** Runs after a successful render, passed the rendered game dir; returns an exit code. */
  format: (gameDir: string) => number | Promise<number>;
  /** Runs after a successful render and format, passed the repo root; returns an exit code. */
  install: (root: string) => number | Promise<number>;
}

/**
 * Runs `biome check --write` on a rendered game. The template is formatted for its `__token__` names, so
 * substituting shorter real names can leave lines that the repo's lint gate would reformat; this makes the
 * scaffolded game pass `bun run lint` as-is. Returns 1 when the binary cannot be spawned.
 *
 * @param bin package-manager binary providing `x <pkg>` (default `bun`).
 */
export function formatGame(gameDir: string, bin = "bun"): number {
  return (
    spawnSync(bin, ["x", "biome", "check", "--write", gameDir], { stdio: "inherit" }).status ?? 1
  );
}

/** Template files a headless game does not ship: the UI client, its build config and its test suites. */
const HEADLESS_EXCLUDE = [
  "ui/",
  "index.html",
  "vite.config.ts",
  "svelte.config.js",
  "vitest.config.ts",
  "tests/App.test.ts",
  "tests/config.test.ts",
  "tests/screens/",
  "tests/helpers/client.ts",
] as const;

/** A headless game keeps one vitest config, under the name `vitest run` auto-discovers. */
const HEADLESS_RENAME = { "vitest.game.config.ts": "vitest.config.ts" } as const;

/** UI-only dev dependencies a headless manifest drops. */
const UI_DEV_DEPENDENCIES = [
  "@sveltejs/vite-plugin-svelte",
  "@testing-library/jest-dom",
  "@testing-library/svelte",
  "jsdom",
  "svelte",
  "svelte-check",
  "vite",
] as const;

/** Scripts a headless manifest drops. */
const HEADLESS_DROPPED_SCRIPTS = ["dev", "build", "test:all"] as const;

interface HeadlessManifest {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
}

/** One anchor -> replacement edit applied to a rendered template file. */
type TextEdit = readonly [anchor: string, replacement: string];

/** Applies each edit exactly once, throwing when the template no longer contains its anchor. */
function replaceOnce(text: string, file: string, edits: readonly TextEdit[]): string {
  let out = text;
  for (const [anchor, replacement] of edits) {
    if (out.split(anchor).length !== 2) {
      throw new Error(`pruneHeadlessGame: ${file} drifted from the headless anchors in create.ts`);
    }
    out = out.replace(anchor, () => replacement);
  }
  return out;
}

/** A headless tsconfig clears the UI type packages that `tsconfig.game.json` pulls in. */
const TSCONFIG_EDIT: TextEdit = [
  '"extends": "@partygame/config/tsconfig.game.json",',
  '"extends": "@partygame/config/tsconfig.game.json",\n  "compilerOptions": {\n    "types": []\n  },',
];

/**
 * The `PhaseName` type exists only for the UI screen map; a headless game drops it, because knip
 * fails on unused exports.
 */
const PHASE_NAMES_EDIT: TextEdit = [
  "\nexport type PhaseName = (typeof PHASE)[keyof typeof PHASE];\n",
  "",
];

/**
 * AGENTS.md rewording for the headless shape. Order matters: `@partygame/game-client` is removed
 * from the Runtime line before it is added to the Dev line, so every anchor matches exactly once.
 */
const AGENTS_EDITS: readonly TextEdit[] = [
  ["rules, UI screens and entry points", "rules and entry points"],
  [", `@partygame/game-client`", ""],
  [", `@partygame/game-ui`", ""],
  ["- Dev: `@partygame/config`", "- Dev: `@partygame/config`, `@partygame/game-client`"],
  [
    "`server.ts`, `launch.ts`, `ui/main.ts`, `bots/cli.ts`, `terminal/play.ts`",
    "`server.ts`, `launch.ts`, `bots/cli.ts`, `terminal/play.ts`",
  ],
  [
    "`tests/game/` (rules), `tests/bots/`, `tests/terminal/`, and UI tests under `tests/`.",
    "`tests/game/` (rules), `tests/bots/`, `tests/terminal/`.",
  ],
];

/** README.md rewording for the headless shape: one test project, no `ui/`. */
const README_EDITS: readonly TextEdit[] = [
  [
    [
      "The suites split across two vitest projects. From this folder:",
      "",
      "```sh",
      "bun run test      # UI project only (tests/App.test.ts, tests/screens/, tests/config.test.ts)",
      "bun run test:all  # both projects: the UI suites plus rules, bots and terminal",
      "```",
    ].join("\n"),
    [
      "The rules, bot and terminal suites live in one vitest project. From this folder:",
      "",
      "```sh",
      "bun run test",
      "```",
    ].join("\n"),
  ],
  ["- `ui/` — the Svelte client: `main.ts` (connection manager), `App.svelte` (screens).\n", ""],
  [
    "Edit the phases in `src/phases/`, the synced fields in `src/state.ts` and the screens in `ui/`.",
    "Edit the phases in `src/phases/` and the synced fields in `src/state.ts`.",
  ],
];

/**
 * Rewrites a rendered game into the headless shape: trims the manifest to what the non-UI code and
 * tests need, clears the UI type packages from tsconfig, drops the UI-only `PhaseName` type, and
 * rewords AGENTS.md and README.md.
 */
export function pruneHeadlessGame(gameDir: string): void {
  const manifestPath = join(gameDir, "package.json");
  const pkg = JSON.parse(readFileSync(manifestPath, "utf8")) as HeadlessManifest;
  const clientVersion = pkg.dependencies["@partygame/game-client"];
  if (clientVersion === undefined) {
    throw new Error("pruneHeadlessGame: package.json drifted: @partygame/game-client is missing");
  }
  delete pkg.dependencies["@partygame/game-ui"];
  for (const name of UI_DEV_DEPENDENCIES) delete pkg.devDependencies[name];
  delete pkg.dependencies["@partygame/game-client"];
  const entries: [string, string][] = [
    ...Object.entries(pkg.devDependencies),
    ["@partygame/game-client", clientVersion],
  ];
  pkg.devDependencies = Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
  for (const script of HEADLESS_DROPPED_SCRIPTS) delete pkg.scripts[script];
  pkg.scripts.typecheck = "tsc --noEmit";
  writeFileSync(manifestPath, `${JSON.stringify(pkg, null, 2)}\n`);

  const tsconfigPath = join(gameDir, "tsconfig.json");
  writeFileSync(
    tsconfigPath,
    replaceOnce(readFileSync(tsconfigPath, "utf8"), "tsconfig.json", [TSCONFIG_EDIT]),
  );
  const phaseNamesPath = join(gameDir, "src", "phaseNames.ts");
  writeFileSync(
    phaseNamesPath,
    replaceOnce(readFileSync(phaseNamesPath, "utf8"), "src/phaseNames.ts", [PHASE_NAMES_EDIT]),
  );
  const agentsPath = join(gameDir, "AGENTS.md");
  writeFileSync(
    agentsPath,
    replaceOnce(readFileSync(agentsPath, "utf8"), "AGENTS.md", AGENTS_EDITS),
  );
  const readmePath = join(gameDir, "README.md");
  writeFileSync(
    readmePath,
    replaceOnce(readFileSync(readmePath, "utf8"), "README.md", README_EDITS),
  );
}

/**
 * Renders a game in the headless shape: drops the UI client and its tests, names the surviving
 * vitest config so `vitest run` auto-discovers it, then runs {@link pruneHeadlessGame}.
 */
export async function renderHeadlessGame(options: {
  templateDir: string;
  outDir: string;
  names: Names;
}): Promise<void> {
  await renderTemplate({ ...options, exclude: HEADLESS_EXCLUDE, rename: HEADLESS_RENAME });
  pruneHeadlessGame(options.outDir);
}

/** Scaffolds `games/<slug>/` from the template and installs. Returns a process exit code. */
export async function runCreate(options: RunCreateOptions): Promise<number> {
  const slug = parseSlug(options.slug);
  if (!slug.ok) {
    console.error(slug.error);
    return 1;
  }
  let root: string;
  try {
    root = await findRepoRoot(options.cwd);
  } catch (error) {
    console.error(errorMessage(error));
    return 1;
  }
  const gameDir = join(root, "games", slug.slug);
  if (existsSync(gameDir)) {
    console.error(`games/${slug.slug}/ already exists`);
    return 1;
  }
  const collision = await findCollision(root, slug.slug);
  if (collision !== undefined) {
    console.error(collision);
    return 1;
  }
  const names = deriveNames(slug.slug);
  if (options.name !== undefined) names.displayName = options.name;
  try {
    await mkdir(gameDir, { recursive: true });
    if (options.headless) {
      await renderHeadlessGame({ templateDir: options.templateDir, outDir: gameDir, names });
    } else {
      await renderTemplate({ templateDir: options.templateDir, outDir: gameDir, names });
    }
  } catch (error) {
    await rm(gameDir, { recursive: true, force: true });
    console.error(`failed to create games/${slug.slug}/: ${errorMessage(error)}`);
    console.error(
      `Removed the incomplete games/${slug.slug}/ directory; run the command again to retry.`,
    );
    return 1;
  }
  const formatCode = await options.format(gameDir);
  if (formatCode !== 0) {
    await rm(gameDir, { recursive: true, force: true });
    console.error(`biome check --write failed with exit code ${formatCode}`);
    console.error(
      `Removed the incomplete games/${slug.slug}/ directory; run the command again to retry.`,
    );
    return formatCode;
  }
  const code = await options.install(root);
  if (code !== 0) {
    console.error(`bun install failed with exit code ${code}`);
    console.error(
      `games/${slug.slug}/ was created but bun install failed. Run bun install again from the repo root, or remove games/${slug.slug}/ and re-run the command.`,
    );
    return code;
  }
  console.log(`Created games/${slug.slug}/. Run \`bun run launch ${slug.slug}\` to play.`);
  console.log(`Commit games/${slug.slug}/ together with the updated bun.lock.`);
  return 0;
}
