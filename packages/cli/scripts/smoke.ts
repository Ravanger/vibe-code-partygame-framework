/**
 * Renders the template to a throwaway game, installs it, runs its tests and typecheck, then cleans up.
 */
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatGame } from "../src/create.js";
import { deriveNames, parseSlug } from "../src/slug.js";
import { renderTemplate } from "../src/template.js";

const SLUG = "zz-smoke-test";
const slugResult = parseSlug(SLUG);
if (!slugResult.ok) throw new Error(`Invalid smoke test slug: ${slugResult.error}`);
const validatedSlug = slugResult.slug;
const names = deriveNames(validatedSlug);
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const templateDir = fileURLToPath(new URL("../template", import.meta.url));
const outDir = join(repoRoot, "games", validatedSlug);

function run(command: string, args: readonly string[]): number {
  console.log(`[smoke] $ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit" });
  if (result.error) console.error(`[smoke] could not start ${command}: ${result.error.message}`);
  return result.status ?? 1;
}

let failed = false;
const fail = (step: string): void => {
  failed = true;
  console.error(`[smoke] FAILED: ${step}`);
};

try {
  rmSync(outDir, { recursive: true, force: true });
  await renderTemplate({ templateDir, outDir, names });
} catch (error) {
  fail(`render (${error instanceof Error ? error.message : String(error)})`);
}

// Same step `create` runs: the template is formatted for its token names, so a real render needs one pass.
if (!failed && formatGame(outDir) !== 0) fail("biome check --write");

let installCode = 0;
if (!failed) {
  installCode = run("bun", ["install"]);
  if (installCode !== 0) fail("bun install");
}

let testCode = 0;
if (!failed) {
  // --passWithNoTests: a project with no test files yet is not a failure.
  testCode = run("bun", [
    "x",
    "vitest",
    "run",
    "--project",
    validatedSlug,
    "--project",
    `${validatedSlug}-game`,
    "--passWithNoTests",
  ]);
  if (testCode !== 0) fail("tests");
}

let typecheckCode = 0;
if (!failed && existsSync(join(outDir, "src"))) {
  typecheckCode = run("bun", [
    "x",
    "turbo",
    "run",
    "typecheck",
    `--filter=@partygame/${validatedSlug}`,
  ]);
  if (typecheckCode !== 0) fail("typecheck");
}

for (const [step, command, args] of [
  ["biome", "bun", ["x", "biome", "check", `games/${validatedSlug}`]],
  ["check:agents", "bun", ["run", "check:agents"]],
  ["check:boundaries", "bun", ["run", "check:boundaries"]],
  ["check:unused", "bun", ["run", "check:unused"]],
] as const) {
  if (!failed && run(command, args) !== 0) fail(step);
}

// Always leave the repo clean: drop the throwaway game and restore the lockfile.
rmSync(outDir, { recursive: true, force: true });
if (run("bun", ["install"]) !== 0) fail("restore bun install");

process.exit(failed ? 1 : 0);
