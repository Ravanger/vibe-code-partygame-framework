/**
 * Renders the template to a throwaway game (`games/cli_smoke/` — an underscored name no real user could pick,
 * but one whose derived identifiers are distinct and valid),
 * installs it, runs its tests and typecheck, then removes it and restores the lockfile. Run with:
 *
 *   bun packages/cli/scripts/smoke.ts
 */
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveNames } from "../src/slug.js";
import { renderTemplate } from "../src/template.js";

const SLUG = "cli_smoke";
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const templateDir = fileURLToPath(new URL("../template", import.meta.url));
const outDir = join(repoRoot, "games", SLUG);

function run(command: string, args: readonly string[]): number {
  console.log(`[smoke] $ ${command} ${args.join(" ")}`);
  return spawnSync(command, args, { cwd: repoRoot, stdio: "inherit" }).status ?? 1;
}

let failed = false;
const fail = (step: string): void => {
  failed = true;
  console.error(`[smoke] FAILED: ${step}`);
};

try {
  rmSync(outDir, { recursive: true, force: true });
  await renderTemplate({ templateDir, outDir, names: deriveNames(SLUG) });
} catch (error) {
  fail(`render (${error instanceof Error ? error.message : String(error)})`);
}

let installCode = 0;
if (!failed) {
  installCode = run("bun", ["install"]);
  if (installCode !== 0) fail("bun install");
}

let testCode = 0;
if (!failed) {
  // --passWithNoTests: a project with no test files yet is not a failure.
  testCode = run("bunx", [
    "vitest",
    "run",
    "--project",
    SLUG,
    "--project",
    `${SLUG}-game`,
    "--passWithNoTests",
  ]);
  if (testCode !== 0) fail("tests");
}

let typecheckCode = 0;
if (!failed && existsSync(join(outDir, "src"))) {
  typecheckCode = run("bunx", ["turbo", "run", "typecheck", `--filter=@partygame/${SLUG}`]);
  if (typecheckCode !== 0) fail("typecheck");
}

// Always leave the repo clean: drop the throwaway game and restore the lockfile.
rmSync(outDir, { recursive: true, force: true });
if (run("bun", ["install"]) !== 0) fail("restore bun install");

process.exit(failed ? 1 : 0);
