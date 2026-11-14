/**
 * Renders the template to two throwaway games — a full UI game and a headless one — installs, runs
 * their tests and typecheck, then cleans up: the cleanup (remove the games, restore bun.lock) runs
 * in `finally` and on SIGINT/SIGTERM.
 */
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatGame, renderHeadlessGame } from "../src/create.js";
import { deriveNames, parseSlug } from "../src/slug.js";
import { renderTemplate } from "../src/template.js";
import {
  cleanupSmoke,
  exitCodeOf,
  registerSmokeSignals,
  runSmokeSteps,
  spawnRun,
} from "./smokeRun.js";

const SLUG = "zz-smoke-test";
const HEADLESS_SLUG = "zz-smoke-headless";
const slugResult = parseSlug(SLUG);
if (!slugResult.ok) throw new Error(`Invalid smoke test slug: ${slugResult.error}`);
const validatedSlug = slugResult.slug;
const headlessResult = parseSlug(HEADLESS_SLUG);
if (!headlessResult.ok) throw new Error(`Invalid smoke test slug: ${headlessResult.error}`);
const headlessSlug = headlessResult.slug;
const names = deriveNames(validatedSlug);
const headlessNames = deriveNames(headlessSlug);
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const templateDir = fileURLToPath(new URL("../template", import.meta.url));
const outDir = join(repoRoot, "games", validatedSlug);
const headlessOutDir = join(repoRoot, "games", headlessSlug);
const run = spawnRun(repoRoot);

// An interrupt of the script itself (not just of a child) must also leave a clean tree.
const cleanup = () => {
  cleanupSmoke({ root: repoRoot, outDir });
  cleanupSmoke({ root: repoRoot, outDir: headlessOutDir });
};
registerSmokeSignals(cleanup);

let ok = false;
try {
  const result = await runSmokeSteps({ root: repoRoot }, [
    {
      name: "render",
      run: async () => {
        try {
          rmSync(outDir, { recursive: true, force: true });
          await renderTemplate({ templateDir, outDir, names });
          return 0;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[smoke] render: ${message}`);
          return 1;
        }
      },
    },
    {
      name: "render headless",
      run: async () => {
        try {
          rmSync(headlessOutDir, { recursive: true, force: true });
          await renderHeadlessGame({ templateDir, outDir: headlessOutDir, names: headlessNames });
          return 0;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[smoke] render headless: ${message}`);
          return 1;
        }
      },
    },
    // Same step `create` runs: the template is formatted for its token names, so a real render needs one pass.
    { name: "biome check --write", run: () => formatGame(outDir) },
    { name: "biome check --write (headless)", run: () => formatGame(headlessOutDir) },
    // One install covers both games: they are workspace members of the same root.
    { name: "bun install", command: "bun", args: ["install"] },
    // --passWithNoTests: a project with no test files yet is not a failure.
    {
      name: "tests",
      command: "bun",
      args: [
        "x",
        "vitest",
        "run",
        "--project",
        validatedSlug,
        "--project",
        `${validatedSlug}-game`,
        "--project",
        `${headlessSlug}-game`,
        "--passWithNoTests",
      ],
    },
    // The headless game's single vitest.config.ts must be auto-discovered from its own folder: the
    // exact command a scaffolded headless game has to run.
    { name: "tests (headless)", command: "bun", args: ["run", "test"], cwd: headlessOutDir },
    {
      name: "typecheck",
      run: () =>
        existsSync(join(outDir, "src")) && existsSync(join(headlessOutDir, "src"))
          ? exitCodeOf(
              run("bun", [
                "x",
                "turbo",
                "run",
                "typecheck",
                `--filter=@partygame/${validatedSlug}`,
                `--filter=@partygame/${headlessSlug}`,
              ]),
            )
          : 0,
    },
    { name: "biome", command: "bun", args: ["x", "biome", "check", `games/${validatedSlug}`] },
    {
      name: "biome (headless)",
      command: "bun",
      args: ["x", "biome", "check", `games/${headlessSlug}`],
    },
    { name: "check:agents", command: "bun", args: ["run", "check:agents"] },
    { name: "check:boundaries", command: "bun", args: ["run", "check:boundaries"] },
    { name: "check:unused", command: "bun", args: ["run", "check:unused"] },
  ]);
  ok = result.ok;
} finally {
  // Always leave the repo clean: drop the throwaway games and restore the lockfile. process.exit
  // skips finally blocks, so it runs only after this one.
  cleanup();
}
process.exit(ok ? 0 : 1);
