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

const TOKENS: ReadonlyArray<readonly [token: string, key: keyof Names]> = [
  ["__slug__", "slug"],
  ["__PascalName__", "pascalName"],
  ["__camelName__", "camelName"],
  ["__DisplayName__", "displayName"],
  ["__roomName__", "roomName"],
];

function substitute(content: string, names: Names): string {
  let out = content;
  for (const [token, key] of TOKENS) out = out.split(token).join(names[key]);
  return out;
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
  for (const file of await filesIn(templateDir)) {
    const content = await readFile(file, "utf8");
    const dest = join(outDir, relative(templateDir, file));
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, substitute(content, names), "utf8");
    await chmod(dest, (await stat(file)).mode & 0o777);
  }
}
