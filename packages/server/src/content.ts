import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { prettifyError, type z } from "zod";

/**
 * Remove // and /* *\/ comments from JSON text WITHOUT touching comment-like
 * sequences inside string literals. A naive regex corrupts prompts containing "https://".
 */
export function stripJsonComments(input: string): string {
  let out = "";
  let inString = false,
    inLine = false,
    inBlock = false,
    escaped = false;

  for (let i = 0; i < input.length; ++i) {
    const ch = input[i];
    const next = input[i + 1];

    if (inLine) {
      if (ch === "\n") {
        inLine = false;
        out += ch;
      }
      continue;
    }
    if (inBlock) {
      if (ch === "*" && next === "/") {
        inBlock = false;
        ++i;
      }
      continue;
    }

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLine = true;
      ++i;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlock = true;
      ++i;
      continue;
    }
    out += ch;
  }
  return out;
}

export interface LoadJsoncDirOptions<T> {
  /** Unique key across all files; a repeat throws. */
  idOf: (item: T) => string;
  /** Used in warnings and errors, e.g. `"Category"`. */
  label: string;
}

/** Every `.json`/`.jsonc` file in `dir`, in name order, parsed with `schema`; invalid files are skipped with a warning. */
export async function loadJsoncDir<S extends z.ZodType>(
  dir: string,
  schema: S,
  options: LoadJsoncDirOptions<z.output<S>>,
): Promise<z.output<S>[]> {
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json") || f.endsWith(".jsonc"));
  } catch {
    throw new Error(`${options.label} directory not found: ${dir}`);
  }
  const loaded: z.output<S>[] = [];
  const seen = new Set<string>();
  for (const file of files.sort()) {
    let json: unknown;
    try {
      json = JSON.parse(stripJsonComments(await readFile(join(dir, file), "utf-8")));
    } catch (error) {
      console.warn(`[${options.label}] Skipping ${file}: ${String(error)}`);
      continue;
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      console.warn(`[${options.label}] Skipping ${file}: ${prettifyError(parsed.error)}`);
      continue;
    }
    const id = options.idOf(parsed.data);
    if (seen.has(id)) throw new Error(`Duplicate ${options.label} id "${id}" in ${file}`);
    seen.add(id);
    loaded.push(parsed.data);
  }
  return loaded;
}
