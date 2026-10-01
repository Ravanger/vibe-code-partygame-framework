import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { shuffle } from "../shuffle.js";
import { stripJsonComments } from "./stripJsonComments.js";

export const PromptSchema = z.object({ id: z.string().min(1), text: z.string().min(1) });

export const CategorySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be lowercase kebab-case"),
  name: z.string().min(1),
  emoji: z.string().default("🎲"),
  prompts: z.array(PromptSchema).min(1),
  tieBreakers: z.array(PromptSchema).default([]),
});

export type Prompt = z.infer<typeof PromptSchema>;
export type Category = z.infer<typeof CategorySchema>;

export class CategoryRepository {
  constructor(private readonly categories: Category[]) {}

  all(): Category[] {
    return [...this.categories];
  }

  byId(id: string): Category | undefined {
    return this.categories.find((c) => c.id === id);
  }

  pickRandom(count: number, rng: () => number = Math.random): Category[] {
    return shuffle(this.categories, rng).slice(0, Math.min(count, this.categories.length));
  }
}

export function categoriesFromArray(categories: Category[]): CategoryRepository {
  return new CategoryRepository(categories);
}

/** Server-side only: touches node:fs. Clients receive categories via synced room state. */
export async function loadCategoriesFromDir(dir: string): Promise<CategoryRepository> {
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json") || f.endsWith(".jsonc"));
  } catch {
    throw new Error(`Category directory not found: ${dir}`);
  }

  const loaded: Category[] = [];
  const seen = new Set<string>();

  for (const file of files.sort()) {
    const path = join(dir, file);
    let parsed: Category;
    try {
      parsed = CategorySchema.parse(JSON.parse(stripJsonComments(await readFile(path, "utf-8"))));
    } catch (e) {
      console.warn(`[CategoryRepository] Skipping ${file}: ${(e as Error).message}`);
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
