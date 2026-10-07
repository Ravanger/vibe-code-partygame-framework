import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { findRepoRoot } from "./repoRoot.js";
import { deriveNames, parseSlug } from "./slug.js";
import { renderTemplate } from "./template.js";

export type CreateArgs = { ok: true; slug: string; name?: string } | { ok: false; error: string };

const USAGE = 'Usage: partygame create <slug> [--name "Display Name"]';

/** Parses `create <slug> [--name "..."]`; a usage error otherwise. */
export function parseCreateArgs(argv: string[]): CreateArgs {
  const [first, ...rest] = argv;
  if (first === undefined) return { ok: false, error: USAGE };
  let name: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg !== "--name") return { ok: false, error: `unexpected argument "${arg}"\n${USAGE}` };
    const value = rest[i + 1];
    if (value === undefined) return { ok: false, error: USAGE };
    name = value;
    i++;
  }
  const slug = parseSlug(first);
  if (!slug.ok) return { ok: false, error: slug.error };
  return { ok: true, slug: slug.slug, ...(name === undefined ? {} : { name }) };
}

/** The message of an `Error`, or its string form. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface RunCreateOptions {
  slug: string;
  name?: string;
  /** Where to start looking for the repo root (usually `process.cwd()`). */
  cwd: string;
  /** Directory of the template files. */
  templateDir: string;
  /** Runs after a successful render, passed the repo root; returns an exit code. */
  install: (root: string) => number | Promise<number>;
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
  const names = deriveNames(slug.slug);
  if (options.name !== undefined) names.displayName = options.name;
  try {
    await mkdir(gameDir, { recursive: true });
    await renderTemplate({ templateDir: options.templateDir, outDir: gameDir, names });
  } catch (error) {
    console.error(`failed to create games/${slug.slug}/: ${errorMessage(error)}`);
    return 1;
  }
  const code = await options.install(root);
  if (code !== 0) {
    console.error(`bun install failed with exit code ${code}`);
    return code;
  }
  console.log(`Created games/${slug.slug}/. Run \`bun run launch ${slug.slug}\` to play.`);
  return 0;
}
