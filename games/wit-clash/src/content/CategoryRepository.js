import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { stripJsonComments } from "./stripJsonComments.js";
export const PromptSchema = z.object({ id: z.string().min(1), text: z.string().min(1) });
export const CategorySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be lowercase kebab-case"),
  name: z.string().min(1),
  emoji: z.string().default("🎲"),
  prompts: z.array(PromptSchema).min(1),
  tieBreakers: z.array(PromptSchema).default([]),
});
/** Server-side only: touches node:fs. Clients receive categories via synced room state. */
export class CategoryRepository {
  categories;
  constructor(categories) {
    this.categories = categories;
  }
  static fromArray(categories) {
    return new CategoryRepository(categories);
  }
  static async loadFromDir(dir) {
    let files;
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith(".json") || f.endsWith(".jsonc"));
    } catch {
      throw new Error(`Category directory not found: ${dir}`);
    }
    const loaded = [];
    const seen = new Set();
    for (const file of files.sort()) {
      const path = join(dir, file);
      let parsed;
      try {
        parsed = CategorySchema.parse(JSON.parse(stripJsonComments(await readFile(path, "utf-8"))));
      } catch (e) {
        console.warn(`[CategoryRepository] Skipping ${file}: ${e.message}`);
        continue;
      }
      if (seen.has(parsed.id)) {
        throw new Error(`Duplicate category id "${parsed.id}" in ${file}`);
      }
      seen.add(parsed.id);
      loaded.push(parsed);
    }
    return new CategoryRepository(loaded);
  }
  all() {
    return [...this.categories];
  }
  byId(id) {
    return this.categories.find((c) => c.id === id);
  }
  pickRandom(count, rng = Math.random) {
    return shuffle(this.categories, rng).slice(0, Math.min(count, this.categories.length));
  }
  randomPrompt(categoryId, rng = Math.random) {
    const pool = this.byId(categoryId)?.prompts ?? [];
    return pool[Math.floor(rng() * pool.length)];
  }
}
export function shuffle(items, rng = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
//# sourceMappingURL=CategoryRepository.js.map
