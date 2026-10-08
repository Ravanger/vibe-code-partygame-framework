import { chmod, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type { Names } from "./slug.js";

export interface RenderTemplateOptions {
  /** Directory of source files containing `__token__` placeholders. */
  templateDir: string;
  /** Where to write the rendered tree, created as needed. */
  outDir: string;
  /** Values substituted for each token. */
  names: Names;
}

// One pass, so substituted values are never re-scanned: a `--name` containing token text stays literal.
const TOKEN_KEYS = {
  __slug__: "slug",
  __PascalName__: "pascalName",
  __camelName__: "camelName",
  __DisplayName__: "displayName",
  // JSON.stringify of the display name, quotes included: safe inside TS/JS string literals.
  __DisplayNameJson__: "displayNameJson",
  __roomName__: "roomName",
} as const satisfies Record<string, keyof TokenValues>;

type Token = keyof typeof TOKEN_KEYS;
const TOKEN_RE = new RegExp(Object.keys(TOKEN_KEYS).join("|"), "g");

/** Everything the template can substitute: the names plus the code-safe form of the display name. */
type TokenValues = Names & { displayNameJson: string };

function tokenValues(names: Names): TokenValues {
  // Derived here so the raw display name stays the single source.
  return { ...names, displayNameJson: JSON.stringify(names.displayName) };
}

function substitute(content: string, values: TokenValues): string {
  // TOKEN_RE only ever matches a key of TOKEN_KEYS, so the lookup is total.
  return content.replace(TOKEN_RE, (token) => values[TOKEN_KEYS[token as Token]]);
}

async function filesIn(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const name of await readdir(dir)) {
    const full = join(dir, name);
    if ((await stat(full)).isDirectory()) files.push(...(await filesIn(full)));
    else files.push(full);
  }
  return files;
}

/** Recursively copies `templateDir` to `outDir`, replacing every token with its derived value. */
export async function renderTemplate({
  templateDir,
  outDir,
  names,
}: RenderTemplateOptions): Promise<void> {
  const source = await stat(templateDir).catch(() => undefined);
  if (!source?.isDirectory()) throw new Error(`template directory not found: ${templateDir}`);
  const values = tokenValues(names);
  for (const file of await filesIn(templateDir)) {
    const content = await readFile(file, "utf8");
    const rel = relative(templateDir, file);
    const dest = join(outDir, substitute(rel, values));
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, substitute(content, values), "utf8");
    await chmod(dest, (await stat(file)).mode & 0o777);
  }
}
