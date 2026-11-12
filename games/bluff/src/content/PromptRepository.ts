import { loadJsoncFile } from "@partygame/content";
import { z } from "zod";

const PromptSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be lowercase kebab-case"),
  question: z.string().min(1),
  truth: z.string().min(1),
});

export type Prompt = z.infer<typeof PromptSchema>;

const PromptsFileSchema = z.object({
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
 * Reads one JSONC file shaped `{ "prompts": [...] }`; a missing file, invalid JSON, a schema
 * failure or a duplicate id throws.
 */
export async function loadPrompts(file: string): Promise<PromptRepository> {
  const data = await loadJsoncFile(file, PromptsFileSchema, { label: "Prompt" });
  const seen = new Set<string>();
  for (const prompt of data.prompts) {
    if (seen.has(prompt.id)) throw new Error(`Duplicate Prompt id "${prompt.id}" in ${file}`);
    seen.add(prompt.id);
  }
  return new PromptRepository(data.prompts);
}
