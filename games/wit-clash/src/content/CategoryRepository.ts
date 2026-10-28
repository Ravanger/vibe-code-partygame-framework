import { loadJsoncDir } from "@partygame/content";
import { z } from "zod";

const PromptSchema = z.object({ id: z.string().min(1), text: z.string().min(1) });

const CategorySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be lowercase kebab-case"),
  name: z.string().min(1),
  emoji: z.string().default("🎲"),
  prompts: z.array(PromptSchema).min(1),
  tieBreakers: z.array(PromptSchema).default([]),
  /** Relative chance of being offered in free play; a weight of 0 means never offered. */
  weight: z.number().min(0).default(1),
  /** Content tag; `mature` categories are only offered when the room's `contentRating` is `"any"`. */
  rating: z.enum(["family", "mature"]).default("family"),
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

  /**
   * Weighted sampling without replacement (Efraimidis-Spirakis): each eligible category gets a key
   * of `rng()^(1/weight)` and the largest keys win, so a weight of 2 is offered about twice as
   * often as one of weight 1. A weight of 0 means never offered; `filter` narrows the pool before
   * drawing (e.g. by content rating). Daily mode does not use this: it plays the canon in order.
   */
  pickRandom(
    count: number,
    rng: () => number = Math.random,
    filter?: (category: Category) => boolean,
  ): Category[] {
    const pool = this.categories.filter((c) => c.weight > 0 && (filter === undefined || filter(c)));
    return pool
      .map((c) => ({ category: c, key: rng() ** (1 / c.weight) }))
      .sort((a, b) => b.key - a.key)
      .slice(0, Math.min(count, pool.length))
      .map(({ category }) => category);
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
