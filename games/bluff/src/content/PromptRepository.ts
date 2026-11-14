import { loadJsoncDirWithFiles } from "@partygame/content";
import { z } from "zod";

const PromptSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be lowercase kebab-case"),
  question: z.string().min(1),
  truth: z.string().min(1),
});

export type Prompt = z.infer<typeof PromptSchema>;

const PromptPackSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be lowercase kebab-case"),
  prompts: z.array(PromptSchema).min(1, "prompts must not be empty"),
});

/** The prompts a game draws from; ids are unique across all files. */
export class PromptRepository {
  constructor(private readonly prompts: Prompt[]) {}

  all(): Prompt[] {
    return [...this.prompts];
  }

  byId(id: string): Prompt | undefined {
    return this.prompts.find((p) => p.id === id);
  }
}

export function promptsFromArray(prompts: Prompt[]): PromptRepository {
  return new PromptRepository(prompts);
}

/**
 * Server-side only: touches node:fs. Clients receive the prompt through synced room state.
 * Reads the directory's `.jsonc` pack files, each shaped `{ "id", "prompts": [...] }`; a missing
 * directory, invalid JSON, a schema failure, a duplicate pack id or a duplicate prompt id throws.
 */
export async function loadPrompts(dir: string): Promise<PromptRepository> {
  const packs = await loadJsoncDirWithFiles(dir, PromptPackSchema, {
    idOf: (pack) => pack.id,
    label: "Pack",
  });
  const seenIn = new Map<string, string>();
  for (const pack of packs) {
    for (const prompt of pack.value.prompts) {
      const earlier = seenIn.get(prompt.id);
      if (earlier !== undefined) {
        throw new Error(
          `Duplicate Prompt id "${prompt.id}" in ${pack.file}; already used in ${earlier}`,
        );
      }
      seenIn.set(prompt.id, pack.file);
    }
  }
  return new PromptRepository(packs.flatMap((pack) => pack.value.prompts));
}
