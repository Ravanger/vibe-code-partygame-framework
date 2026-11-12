import { chmod, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { htmlEscape, markdownEscape, type Names } from "./slug.js";

export interface RenderTemplateOptions {
  /** Directory of source files containing `__token__` placeholders. */
  templateDir: string;
  /** Where to write the rendered tree, created as needed. */
  outDir: string;
  /** Values substituted for each token. */
  names: Names;
  /** Relative paths (to `templateDir`) to skip: a file path, or a directory prefix ending in `/`. */
  exclude?: readonly string[];
  /** Relative source path (to `templateDir`) -> relative destination path, for a file that moves while rendering. */
  rename?: Record<string, string>;
}

// One pass, so substituted values are never re-scanned: a `--name` containing token text stays literal.
const TOKEN_KEYS = {
  __slug__: "slug",
  __PascalName__: "pascalName",
  __camelName__: "camelName",
  __DisplayName__: "displayName",
  __DisplayNameJson__: "displayNameJson",
  __DisplayNameJsonText__: "displayNameJsonText",
  __DisplayNameHtml__: "displayNameHtml",
  __DisplayNameMd__: "displayNameMd",
  __roomName__: "roomName",
} as const satisfies Record<string, keyof TokenValues>;

type Token = keyof typeof TOKEN_KEYS;
const TOKEN_RE = new RegExp(Object.keys(TOKEN_KEYS).join("|"), "g");

/**
 * Everything the template can substitute: the names plus the code-, HTML- and Markdown-safe forms of
 * the display name.
 */
type TokenValues = Names & {
  displayNameJson: string;
  displayNameJsonText: string;
  displayNameHtml: string;
  displayNameMd: string;
};

function tokenValues(names: Names): TokenValues {
  const json = JSON.stringify(names.displayName);
  return {
    ...names,
    displayNameJson: json,
    displayNameJsonText: json.slice(1, -1),
    displayNameHtml: htmlEscape(names.displayName),
    displayNameMd: markdownEscape(names.displayName),
  };
}

function substitute(content: string, values: TokenValues): string {
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

/** True when `rel` is a file listed in `exclude`, or lives under an excluded directory prefix. */
function excluded(rel: string, exclude: readonly string[]): boolean {
  return exclude.some(
    (pattern) => rel === pattern || (pattern.endsWith("/") && rel.startsWith(pattern)),
  );
}

/** Recursively copies `templateDir` to `outDir`, replacing every token with its derived value. */
export async function renderTemplate({
  templateDir,
  outDir,
  names,
  exclude = [],
  rename,
}: RenderTemplateOptions): Promise<void> {
  const source = await stat(templateDir).catch(() => undefined);
  if (!source?.isDirectory()) throw new Error(`template directory not found: ${templateDir}`);
  const values = tokenValues(names);
  for (const file of await filesIn(templateDir)) {
    const rel = relative(templateDir, file);
    if (excluded(rel, exclude)) continue;
    const content = await readFile(file, "utf8");
    const dest = join(outDir, substitute(rename?.[rel] ?? rel, values));
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, substitute(content, values), "utf8");
    await chmod(dest, (await stat(file)).mode & 0o777);
  }
}
