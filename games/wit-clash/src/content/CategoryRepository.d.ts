import { z } from "zod";
export declare const PromptSchema: z.ZodObject<
  {
    id: z.ZodString;
    text: z.ZodString;
  },
  z.core.$strip
>;
export declare const CategorySchema: z.ZodObject<
  {
    id: z.ZodString;
    name: z.ZodString;
    emoji: z.ZodDefault<z.ZodString>;
    prompts: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          text: z.ZodString;
        },
        z.core.$strip
      >
    >;
    tieBreakers: z.ZodDefault<
      z.ZodArray<
        z.ZodObject<
          {
            id: z.ZodString;
            text: z.ZodString;
          },
          z.core.$strip
        >
      >
    >;
  },
  z.core.$strip
>;
export type Prompt = z.infer<typeof PromptSchema>;
export type Category = z.infer<typeof CategorySchema>;
/** Server-side only: touches node:fs. Clients receive categories via synced room state. */
export declare class CategoryRepository {
  private readonly categories;
  private constructor();
  static fromArray(categories: Category[]): CategoryRepository;
  static loadFromDir(dir: string): Promise<CategoryRepository>;
  all(): Category[];
  byId(id: string): Category | undefined;
  pickRandom(count: number, rng?: () => number): Category[];
  randomPrompt(categoryId: string, rng?: () => number): Prompt | undefined;
}
export declare function shuffle<T>(items: readonly T[], rng?: () => number): T[];
//# sourceMappingURL=CategoryRepository.d.ts.map
