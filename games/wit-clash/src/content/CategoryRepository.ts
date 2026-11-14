import { type ContentFile, loadJsoncDirWithFiles } from "@partygame/content";
import { weightedSample } from "@partygame/core";
import { z } from "zod";

const PromptSchema = z.object({ id: z.string().min(1), text: z.string().min(1) }).strict();

const CategorySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, "id must be lowercase kebab-case"),
    name: z.string().min(1),
    emoji: z.string().default("🎲"),
    prompts: z.array(PromptSchema).min(1),
    tieBreakers: z.array(PromptSchema).default([]),
    /** Relative chance of being offered; 0 never offers the category. */
    weight: z.number().min(0).default(1),
    /** "mature" categories are only offered when the room's content rating allows them. */
    rating: z.enum(["family", "mature"]).default("family"),
  })
  .strict();

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
   * `count` distinct categories from the candidates (weight > 0, and passing `filter` when given),
   * drawn with core's `weightedSample`: equal weights deal a uniform shuffle, differing weights use
   * Efraimidis–Spirakis sampling. A weight of 0 means never offered.
   */
  pickRandom(
    count: number,
    rng: () => number,
    filter?: (category: Category) => boolean,
  ): Category[] {
    return weightedSample(
      this.categories.filter((c) => filter?.(c) ?? true),
      count,
      rng,
      (c) => c.weight,
    );
  }
}

export function categoriesFromArray(categories: Category[]): CategoryRepository {
  return new CategoryRepository(categories);
}

const PROMPT_LISTS = ["prompts", "tieBreakers"] as const;

/** The loader's error prefix for this content kind; duplicate-prompt errors carry it too. */
const LABEL = "Category";

/** Prompt ids are remembered across the whole game and prompts and tie-breakers share one id space,
 * so a repeat anywhere is an error; every repeat is listed in one throw. */
function checkPromptIds(files: ContentFile<Category>[]): void {
  const seen = new Map<string, { file: string; categoryId: string; where: string }>();
  const problems: string[] = [];
  for (const { file, value } of files) {
    for (const list of PROMPT_LISTS) {
      value[list].forEach((prompt, index) => {
        const where = `${list}[${index}]`;
        const first = seen.get(prompt.id);
        if (first === undefined) {
          seen.set(prompt.id, { file, categoryId: value.id, where });
          return;
        }
        problems.push(
          `[${LABEL}] Duplicate prompt id "${prompt.id}" at ${where} in ${file} (category "${value.id}"); already used at ${first.where} in ${first.file} (category "${first.categoryId}")`,
        );
      });
    }
  }
  if (problems.length > 0) throw new Error(problems.join("\n"));
}

/** Server-side only: touches node:fs. Clients receive categories via synced room state. */
export async function loadCategoriesFromDir(dir: string): Promise<CategoryRepository> {
  const files = await loadJsoncDirWithFiles(dir, CategorySchema, {
    idOf: (c) => c.id,
    label: LABEL,
  });
  checkPromptIds(files);
  return new CategoryRepository(files.map((f) => f.value));
}
