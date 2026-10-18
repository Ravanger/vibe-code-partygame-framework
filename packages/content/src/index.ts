import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { prettifyError, type z } from "zod";

/**
 * Remove // and /* *\/ comments from JSON text WITHOUT touching comment-like
 * sequences inside string literals. A naive regex corrupts values containing "https://".
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
  /** Used in warnings and errors, e.g. `"Item"`. */
  label: string;
  /** A file that fails to parse or the validation: throw by default, or skip it with a `console.warn` as before. */
  onInvalid?: "throw" | "skip";
  /** Most content files in the directory (default 256). */
  maxFiles?: number;
  /** Largest single content file in bytes (default 1 MiB). */
  maxFileBytes?: number;
}

const DEFAULT_MAX_FILES = 256;
const DEFAULT_MAX_FILE_BYTES = 1_048_576;

/**
 * Every regular `.json`/`.jsonc` file in `dir`, in name order, parsed with `schema`. Symlinks and
 * subdirectories are ignored. A missing directory, a duplicate id, more files than `maxFiles` or a
 * file above `maxFileBytes` throws; so does an unparsable file or a schema failure unless
 * `onInvalid: "skip"`, which skips them with a warning instead.
 */
export async function loadJsoncDir<S extends z.ZodType>(
  dir: string,
  schema: S,
  options: LoadJsoncDirOptions<z.output<S>>,
): Promise<z.output<S>[]> {
  const onInvalid = options.onInvalid ?? "throw";
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    throw new Error(`${options.label} directory not found: ${dir}`);
  }
  const files = entries
    .filter(
      (entry) => entry.isFile() && (entry.name.endsWith(".json") || entry.name.endsWith(".jsonc")),
    )
    .map((entry) => entry.name)
    .sort();
  if (files.length > maxFiles) {
    throw new Error(
      `[${options.label}] ${files.length} content files in ${dir} exceed the maximum of ${maxFiles}`,
    );
  }
  const loaded: z.output<S>[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    if ((await stat(join(dir, file))).size > maxFileBytes) {
      throw new Error(
        `[${options.label}] ${file} is larger than the maximum of ${maxFileBytes} bytes`,
      );
    }
    let json: unknown;
    try {
      json = JSON.parse(stripJsonComments(await readFile(join(dir, file), "utf-8")));
    } catch (error) {
      if (onInvalid === "skip") {
        console.warn(`[${options.label}] Skipping ${file}: ${String(error)}`);
        continue;
      }
      throw new Error(`[${options.label}] Invalid JSON in ${file}: ${String(error)}`);
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      if (onInvalid === "skip") {
        console.warn(`[${options.label}] Skipping ${file}: ${prettifyError(parsed.error)}`);
        continue;
      }
      throw new Error(
        `[${options.label}] ${file} failed validation: ${prettifyError(parsed.error)}`,
      );
    }
    const id = options.idOf(parsed.data);
    if (seen.has(id)) throw new Error(`Duplicate ${options.label} id "${id}" in ${file}`);
    seen.add(id);
    loaded.push(parsed.data);
  }
  return loaded;
}
