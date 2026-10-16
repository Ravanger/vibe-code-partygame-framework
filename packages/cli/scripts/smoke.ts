/**
 * Renders the template to a throwaway game, installs it, runs its tests and typecheck, then cleans
 * up: the cleanup (remove the game, restore bun.lock) runs in `finally` and on SIGINT/SIGTERM.
 */
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatGame } from "../src/create.js";
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
const slugResult = parseSlug(SLUG);
if (!slugResult.ok) throw new Error(`Invalid smoke test slug: ${slugResult.error}`);
const validatedSlug = slugResult.slug;
const names = deriveNames(validatedSlug);
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const templateDir = fileURLToPath(new URL("../template", import.meta.url));
const outDir = join(repoRoot, "games", validatedSlug);
const run = spawnRun(repoRoot);

// An interrupt of the script itself (not just of a child) must also leave a clean tree.
registerSmokeSignals(() => cleanupSmoke({ root: repoRoot, outDir }));

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
    // Same step `create` runs: the template is formatted for its token names, so a real render needs one pass.
    { name: "biome check --write", run: () => formatGame(outDir) },
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
        "--passWithNoTests",
      ],
    },
    {
      name: "typecheck",
      run: () =>
        existsSync(join(outDir, "src"))
          ? exitCodeOf(
              run("bun", [
                "x",
                "turbo",
                "run",
                "typecheck",
                `--filter=@partygame/${validatedSlug}`,
              ]),
            )
          : 0,
    },
    { name: "biome", command: "bun", args: ["x", "biome", "check", `games/${validatedSlug}`] },
    { name: "check:agents", command: "bun", args: ["run", "check:agents"] },
    { name: "check:boundaries", command: "bun", args: ["run", "check:boundaries"] },
    { name: "check:unused", command: "bun", args: ["run", "check:unused"] },
  ]);
  ok = result.ok;
} finally {
  // Always leave the repo clean: drop the throwaway game and restore the lockfile. process.exit
  // skips finally blocks, so it runs only after this one.
  cleanupSmoke({ root: repoRoot, outDir });
}
process.exit(ok ? 0 : 1);
