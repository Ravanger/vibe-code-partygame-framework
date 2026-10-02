import { shuffle } from "@partygame/core";
import { loadJsoncDir } from "@partygame/server/content";
import { z } from "zod";

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
  return new CategoryRepository(
    await loadJsoncDir(dir, CategorySchema, { idOf: (c) => c.id, label: "Category" }),
  );
}
