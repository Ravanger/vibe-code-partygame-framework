import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// import.meta.url goes straight to fileURLToPath: under jsdom the global URL
// resolver ignores file: bases, so new URL(rel, import.meta.url) is not usable here.
const UI_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "ui");

export interface CssRule {
  selector: string;
  decls: Record<string, string>;
  media: string[];
}

export function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

export function cssFiles(): Array<{ file: string; css: string }> {
  const out: Array<{ file: string; css: string }> = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(css|svelte)$/.test(entry.name)) continue;
      const text = readFileSync(path, "utf8");
      const raw = entry.name.endsWith(".svelte")
        ? [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n")
        : text;
      const css = stripComments(raw);
      if (css.trim() !== "") out.push({ file: path.slice(UI_DIR.length + 1), css });
    }
  };
  walk(UI_DIR);
  return out;
}

export function rules(css: string): CssRule[] {
  const out: CssRule[] = [];
  let i = 0;
  while (i < css.length) {
    const brace = css.indexOf("{", i);
    if (brace < 0) break;
    const pre = css.slice(i, brace).trim();
    let depth = 1;
    let j = brace + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") ++depth;
      else if (css[j] === "}") --depth;
      ++j;
    }
    const body = css.slice(brace + 1, j - 1);
    i = j;
    const condition = /^@media\s+(.+)$/.exec(pre)?.[1]?.trim();
    if (condition !== undefined) {
      for (const rule of rules(body)) out.push({ ...rule, media: [...rule.media, condition] });
      continue;
    }
    if (pre.startsWith("@") || pre === "") continue;
    const decls: Record<string, string> = {};
    for (const line of body.split(";")) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const name = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).trim();
      if (name !== "" && !(name in decls)) decls[name] = value;
    }
    out.push({ selector: pre, decls, media: [] });
  }
  return out;
}
